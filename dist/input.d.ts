import type { Readable } from "node:stream";
import type { InputLimits, LimitsApplied } from "./types.js";
export declare const DEFAULT_LIMITS: InputLimits;
export declare function resolveLimits(limits?: Partial<InputLimits>): InputLimits;
export declare function measureInput(text: string, limits: InputLimits): LimitsApplied;
export declare function readStreamLimited(stream: Readable, limits: InputLimits): Promise<string>;
export declare function readInput(path: string, limits: InputLimits): Promise<string>;
