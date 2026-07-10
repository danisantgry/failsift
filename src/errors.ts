export class FailSiftError extends Error {
  constructor(
    message: string,
    public readonly exitCode: 2 | 3,
    options?: ErrorOptions
  ) {
    super(message, options);
    this.name = "FailSiftError";
  }
}

export class InputError extends FailSiftError {
  constructor(message: string, options?: ErrorOptions) {
    super(message, 2, options);
    this.name = "InputError";
  }
}

export class NetworkError extends FailSiftError {
  constructor(message: string, options?: ErrorOptions) {
    super(message, 3, options);
    this.name = "NetworkError";
  }
}
