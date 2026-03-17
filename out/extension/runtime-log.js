"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.RuntimeLog = void 0;
const promises_1 = require("node:fs/promises");
const path = require("node:path");
class RuntimeLog {
    filePath;
    tag;
    writeChain = Promise.resolve();
    constructor(filePath, tag) {
        this.filePath = filePath;
        this.tag = tag;
    }
    error(event, details) {
        this.write("error", event, details);
    }
    info(event, details) {
        this.write("info", event, details);
    }
    warn(event, details) {
        this.write("warn", event, details);
    }
    write(level, event, details) {
        const entry = JSON.stringify({
            details: sanitizeForLog(details),
            event,
            level,
            tag: this.tag,
            ts: new Date().toISOString(),
        });
        this.writeChain = this.writeChain
            .then(async () => {
            await (0, promises_1.mkdir)(path.dirname(this.filePath), { recursive: true });
            await (0, promises_1.appendFile)(this.filePath, `${entry}\n`);
        })
            .catch(() => {
            // Ignore logging failures so they never affect extension/runtime behavior.
        });
    }
}
exports.RuntimeLog = RuntimeLog;
function sanitizeForLog(value) {
    if (value === null || value === undefined) {
        return value;
    }
    if (typeof value === "string") {
        return value.length > 400 ? `${value.slice(0, 400)}…` : value;
    }
    if (typeof value === "number" || typeof value === "boolean") {
        return value;
    }
    if (Array.isArray(value)) {
        return value.map((item) => sanitizeForLog(item));
    }
    if (value instanceof Error) {
        return {
            message: value.message,
            name: value.name,
            stack: value.stack,
        };
    }
    if (typeof value === "object") {
        return Object.fromEntries(Object.entries(value).map(([key, item]) => [
            key,
            sanitizeForLog(item),
        ]));
    }
    return JSON.stringify(value);
}
//# sourceMappingURL=runtime-log.js.map