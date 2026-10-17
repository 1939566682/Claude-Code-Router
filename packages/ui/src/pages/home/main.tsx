import React from "react";
import { createRoot } from "react-dom/client";
import { BaseUiProvider } from "@/lib/baseui-provider";
import { ErrorBoundary } from "@/components/ui/error-boundary";
import App from "./App";

const container = document.getElementById("root");

if (!container) {
  throw new Error("Root element not found");
}

createRoot(container).render(
  <React.StrictMode>
    <BaseUiProvider>
      <ErrorBoundary fallbackTitle="页面渲染失败">
        <App />
      </ErrorBoundary>
    </BaseUiProvider>
  </React.StrictMode>
);
