import { AbstractException } from "./AbstractException.js";

export abstract class AbstractNotFoundException extends AbstractException {
  readonly statusCode = 404;
}
