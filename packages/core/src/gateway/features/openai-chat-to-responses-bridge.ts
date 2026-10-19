import { pipeline, Readable, Transform } from "node:stream";
import { StringDecoder } from "node:string_decoder";
import { isRecord, rawStringValue } from "@ccr/core/gateway/internal/value";

// Codex sends POST /v1/responses (openai_responses) but a Chat-only upstream
// (e.g. gpt-5.6-sol via openai_chat_completions) streams `choices[].delta`
// SSE.  Without re-framing, Codex incremental parser sees no
// `response.output_text.delta` events and renders one sentence truncated
// before the next frame arrives ("一句截断后自续").
// This bridge reframes a Chat SSE stream into Responses SSE in-memory so
// upstream adapters can stay Chat-native while Codex stays Responses-native.
//
// Codex >= 0.162 parser requirements (verified against rust-v0.162.0-alpha.17.2
// codex-rs/codex-api/src/sse/responses.rs):
//   - response.output_text.delta          requires `delta`
//   - response.reasoning_text.delta       requires `delta` + `content_index`
//   - response.reasoning_summary_text.delta requires `delta` + `summary_index`
//   - response.completed                  requires `response.id`
// Events missing a required field are dropped whole, so every synthesized
// event below carries its mandatory fields.

type ChatToResponsesSseTransform = Transform & {
  __chat2respDecoder?: StringDecoder;
  __chat2respPending?: string;
  __chat2respSeq?: number;
  __chat2respResponseId?: string;
  __chat2respItemId?: string;
  __chat2respOutputIndex?: number;
  __chat2respOutputText?: string;
};

const RESPONSES_DELTA_EVENT = "response.output_text.delta";
const RESPONSES_REASONING_DELTA_EVENT = "response.reasoning_summary_text.delta";
const RESPONSES_DONE_EVENT = "response.completed";

// Reframes one Chat Completions chunk into zero or more Responses SSE frames.
// A chunk may carry content AND finish_reason in the same object (DeepSeek /
// vLLM / Qwen style): the content delta must be emitted BEFORE the synthesized
// response.completed, otherwise the tail of the message is silently dropped.
function chatDeltaToResponsesEvents(
  payload: Record<string, unknown>,
  state: ChatToResponsesSseTransform
): string[] {
  const frames: string[] = [];
  const choices = Array.isArray(payload.choices) ? payload.choices : [];
  const choice = isRecord(choices[0]) ? choices[0] as Record<string, unknown> : undefined;
  if (!choice) {
    return frames;
  }

  const finishReason = rawStringValue(choice.finish_reason);
  const delta = isRecord(choice.delta) ? choice.delta as Record<string, unknown> : undefined;
  const content = delta ? rawStringValue(delta.content) : undefined;
  const reasoning = delta
    ? (rawStringValue(delta.reasoning_content) ?? rawStringValue(delta.reasoning))
    : undefined;

  const respId = state.__chat2respResponseId ?? `resp_${Date.now().toString(36)}`;
  state.__chat2respResponseId = respId;
  const itemId = state.__chat2respItemId ?? `msg_${respId.slice(-8)}`;
  state.__chat2respItemId = itemId;
  const outputIndex = state.__chat2respOutputIndex ?? 0;
  state.__chat2respOutputIndex = outputIndex;

  const nextSeq = () => {
    const seq = (state.__chat2respSeq ?? 0) + 1;
    state.__chat2respSeq = seq;
    return seq;
  };

  if (content) {
    state.__chat2respOutputText = (state.__chat2respOutputText ?? "") + content;
    frames.push(
      `event: ${RESPONSES_DELTA_EVENT}\ndata: ${JSON.stringify({
        type: RESPONSES_DELTA_EVENT,
        sequence_number: nextSeq(),
        output_index: outputIndex,
        content_index: 0,
        item_id: itemId,
        delta: content
      })}\n`
    );
  }
  if (reasoning) {
    frames.push(
      `event: ${RESPONSES_REASONING_DELTA_EVENT}\ndata: ${JSON.stringify({
        type: RESPONSES_REASONING_DELTA_EVENT,
        sequence_number: nextSeq(),
        output_index: outputIndex,
        summary_index: 0,
        item_id: itemId,
        delta: reasoning
      })}\n`
    );
  }
  if (finishReason) {
    // Synthesize a Responses completed so Codex closes the incremental buffer.
    const done = {
      type: RESPONSES_DONE_EVENT,
      sequence_number: nextSeq(),
      response: {
        id: respId,
        status: "completed",
        output_text: state.__chat2respOutputText ?? "",
        output: []
      }
    };
    frames.push(`event: ${RESPONSES_DONE_EVENT}\ndata: ${JSON.stringify(done)}\n`);
  }
  // tool_calls and other non-text deltas are not reframed here: the core
  // gateway performs the full conversion when it can; this bridge is the
  // fallback for text-bearing streams.
  return frames;
}

// A Chat SSE block is one whose data JSON has a top-level `choices` array.
// Substring matching is wrong: a Responses event whose delta text merely
// mentions "choices" would be misdetected as chat and then dropped.
function parseChatSseBlock(raw: string): Record<string, unknown> | undefined {
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return undefined;
  }
  if (!isRecord(parsed) || !Array.isArray(parsed.choices)) {
    return undefined;
  }
  return parsed;
}

function transformChunk(stream: Transform, chunk: Buffer | string): void {
  const state = stream as ChatToResponsesSseTransform;
  const decoder = state.__chat2respDecoder ?? new StringDecoder("utf8");
  state.__chat2respDecoder = decoder;
  state.__chat2respPending = (state.__chat2respPending ?? "") + decoder.write(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
  const push = (s: string) => (stream as unknown as { push: (s: string) => void }).push(s);
  while (state.__chat2respPending) {
    const m = /\r?\n\r?\n/.exec(state.__chat2respPending);
    if (!m || m.index === undefined) break;
    const block = state.__chat2respPending.slice(0, m.index);
    const delim = m[0];
    state.__chat2respPending = state.__chat2respPending.slice(m.index + delim.length);
    const dataLine = block.split(/\r?\n/g).find((l) => l.startsWith("data:"));
    if (!dataLine) {
      // Comments / event-only blocks pass through untouched.
      push(block + delim);
      continue;
    }
    const raw = dataLine.slice(5).replace(/^ /, "");
    const chatPayload = raw === "[DONE]" ? undefined : parseChatSseBlock(raw);
    if (!chatPayload) {
      // Already Responses-shaped (or [DONE], or unparseable): pass through.
      push(block + delim);
      continue;
    }
    for (const frame of chatDeltaToResponsesEvents(chatPayload, state)) {
      push(frame + "\n");
    }
  }
}

function flushTransform(stream: Transform): void {
  const state = stream as ChatToResponsesSseTransform;
  const push = (s: string) => (stream as unknown as { push: (s: string) => void }).push(s);
  state.__chat2respPending = (state.__chat2respPending ?? "") + (state.__chat2respDecoder?.end() ?? "");
  const block = state.__chat2respPending;
  state.__chat2respPending = "";
  if (!block.trim()) {
    return;
  }
  const dataLine = block.split(/\r?\n/g).find((l) => l.startsWith("data:"));
  const raw = dataLine ? dataLine.slice(5).replace(/^ /, "") : "";
  const chatPayload = raw && raw !== "[DONE]" ? parseChatSseBlock(raw) : undefined;
  if (!chatPayload) {
    push(block);
    return;
  }
  const frames = chatDeltaToResponsesEvents(chatPayload, state);
  if (frames.length > 0) {
    for (const frame of frames) push(frame + "\n");
  } else {
    push(block);
  }
}

export function openAiChatToResponsesBridgeStream(input: Readable, headers: Headers): Readable {
  const contentType = headers.get("content-type")?.toLowerCase() ?? "";
  if (!contentType.includes("text/event-stream")) return input;
  return pipeline(input, new Transform({
    transform(chunk, _enc, cb) { transformChunk(this, chunk); cb(); },
    flush(cb) { flushTransform(this); cb(); }
  }), () => {});
}
