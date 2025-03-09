import { AbstractBadRequestException } from "../../shared/exceptions/AbstractBadRequestException.js";

export class InvalidParamException extends AbstractBadRequestException {
  readonly code = "INVALID_PARAM_EXCEPTION";
}
