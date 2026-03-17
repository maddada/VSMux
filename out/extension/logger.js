"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.initializeLogger = initializeLogger;
exports.logError = logError;
exports.logInfo = logInfo;
exports.logWarn = logWarn;
const vscode = require("vscode");
const OUTPUT_CHANNEL_NAME = "Agent Manager X";
let outputChannel;
function initializeLogger(context) {
    if (outputChannel) {
        return;
    }
    outputChannel = vscode.window.createOutputChannel(OUTPUT_CHANNEL_NAME, {
        log: true,
    });
    context.subscriptions.push(outputChannel);
}
function logError(message, details) {
    writeLog("error", message, details);
}
function logInfo(message, details) {
    writeLog("info", message, details);
}
function logWarn(message, details) {
    writeLog("warn", message, details);
}
function writeLog(level, message, details) {
    if (!outputChannel) {
        return;
    }
    const suffix = details ? ` ${JSON.stringify(details)}` : "";
    outputChannel.appendLine(`[${level}] ${message}${suffix}`);
}
//# sourceMappingURL=logger.js.map