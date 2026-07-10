export declare class FailSiftError extends Error {
    readonly exitCode: 2 | 3;
    constructor(message: string, exitCode: 2 | 3, options?: ErrorOptions);
}
export declare class InputError extends FailSiftError {
    constructor(message: string, options?: ErrorOptions);
}
export declare class NetworkError extends FailSiftError {
    constructor(message: string, options?: ErrorOptions);
}
