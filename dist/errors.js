export class FailSiftError extends Error {
    exitCode;
    constructor(message, exitCode, options) {
        super(message, options);
        this.exitCode = exitCode;
        this.name = "FailSiftError";
    }
}
export class InputError extends FailSiftError {
    constructor(message, options) {
        super(message, 2, options);
        this.name = "InputError";
    }
}
export class NetworkError extends FailSiftError {
    constructor(message, options) {
        super(message, 3, options);
        this.name = "NetworkError";
    }
}
