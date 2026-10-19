const baseConfig = require("../electron-builder.json");
const DEV_OUTPUT = "D:/SoftWare/gateway/claude-code-router-dev";

const config = {
  ...baseConfig,
  appId: "com.claudecoderouter.desktop.dev",
  productName: "Claude Code Router Dev",
  directories: {
    ...baseConfig.directories,
    output: DEV_OUTPUT,
  },
  mac: {
    ...baseConfig.mac,
    identity: "-",
    notarize: false,
    forceCodeSigning: false,
  },
  win: {
    ...baseConfig.win,
    artifactName: "Claude-Code-Router-Dev_${version}.${ext}",
  },
  linux: {
    ...baseConfig.linux,
    artifactName: "Claude-Code-Router-Dev_${version}.${ext}",
  },
  nsis: {
    ...baseConfig.nsis,
    shortcutName: "Claude Code Router Dev",
  },
};

delete config.afterSign;

// protocols 仍为 ccr://（与原版冲突时后装的抢注册，串行使用无感；
// 若需协议也隔离，改 schemes: ["ccr-dev"]）
config.protocols = [
  { name: "Claude Code Router Dev Provider Import", schemes: ["ccr"] },
];

module.exports = config;
