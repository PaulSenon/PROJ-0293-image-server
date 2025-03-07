interface Params {
  publicMessage: string;
  privateMessage?: string;
  error?: Error;
}

export abstract class AbstractException extends Error {
  // unique exception identifier
  abstract readonly code: string;
  // http status code
  readonly statusCode: number = 500;

  // message to be displayed to the user
  readonly privateMessage: string;
  readonly publicMessage: string;
  readonly error?: Error;

  constructor(params: Params) {
    super();
    this.publicMessage = params.publicMessage;
    this.privateMessage = params.privateMessage ?? this.publicMessage;
    this.error = params.error;
  }

  getPublicMessage(): string {
    return this.publicMessage;
  }
}
