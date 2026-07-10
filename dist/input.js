import { createReadStream } from "node:fs";
import { stat } from "node:fs/promises";
import { InputError } from "./errors.js";
export const DEFAULT_LIMITS = {
    maxBytes: 50 * 1024 * 1024,
    maxLines: 200_000
};
export function resolveLimits(limits = {}) {
    const resolved = {
        maxBytes: limits.maxBytes ?? DEFAULT_LIMITS.maxBytes,
        maxLines: limits.maxLines ?? DEFAULT_LIMITS.maxLines
    };
    if (!Number.isSafeInteger(resolved.maxBytes) || resolved.maxBytes <= 0) {
        throw new InputError("The maximum input size must be a positive integer.");
    }
    if (!Number.isSafeInteger(resolved.maxLines) || resolved.maxLines <= 0) {
        throw new InputError("The maximum line count must be a positive integer.");
    }
    return resolved;
}
export function measureInput(text, limits) {
    const bytesRead = Buffer.byteLength(text);
    const linesRead = text.length === 0 ? 0 : text.split(/\r?\n/u).length;
    if (bytesRead > limits.maxBytes) {
        throw new InputError(`Input exceeds the ${formatMegabytes(limits.maxBytes)} MB size limit.`);
    }
    if (linesRead > limits.maxLines) {
        throw new InputError(`Input exceeds the ${limits.maxLines.toLocaleString("en-US")} line limit.`);
    }
    return { ...limits, bytesRead, linesRead, truncated: false };
}
export async function readStreamLimited(stream, limits) {
    const chunks = [];
    let bytesRead = 0;
    for await (const value of stream) {
        const chunk = Buffer.isBuffer(value)
            ? value
            : value instanceof Uint8Array
                ? Buffer.from(value)
                : Buffer.from(String(value));
        bytesRead += chunk.length;
        if (bytesRead > limits.maxBytes) {
            stream.destroy();
            throw new InputError(`Input exceeds the ${formatMegabytes(limits.maxBytes)} MB size limit.`);
        }
        chunks.push(chunk);
    }
    const text = Buffer.concat(chunks).toString("utf8");
    measureInput(text, limits);
    return text;
}
export async function readInput(path, limits) {
    if (path === "-")
        return readStreamLimited(process.stdin, limits);
    let info;
    try {
        info = await stat(path);
    }
    catch (error) {
        throw new InputError(`Cannot read input file: ${path}`, { cause: error });
    }
    if (!info.isFile())
        throw new InputError(`Input path is not a file: ${path}`);
    if (info.size > limits.maxBytes) {
        throw new InputError(`Input exceeds the ${formatMegabytes(limits.maxBytes)} MB size limit.`);
    }
    return readStreamLimited(createReadStream(path), limits);
}
function formatMegabytes(bytes) {
    return (bytes / (1024 * 1024)).toLocaleString("en-US", { maximumFractionDigits: 2 });
}
