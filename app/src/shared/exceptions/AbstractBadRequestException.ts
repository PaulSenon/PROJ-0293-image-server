import { AbstractException } from "./AbstractException.js";

export abstract class AbstractBadRequestException extends AbstractException {
  readonly statusCode = 400;
}
