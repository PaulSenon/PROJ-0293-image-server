import { AbstractException } from "../../shared/exceptions/AbstractException.js";

export class ImageProcessingException extends AbstractException {
  readonly code = "IMAGE_PROCESSING_EXCEPTION";
}
