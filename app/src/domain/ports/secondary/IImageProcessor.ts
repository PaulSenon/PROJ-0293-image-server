import type { ImageProcessorParams } from "../../../shared/dto/ImageProcessorParams.dto.js";
import type { Stream } from "../../../shared/domainObjects.types.js";
import type { Result } from "../../../shared/utils/Result/result.types.js";
import type { ImageProcessingException } from "../../exceptions/ImageProcessingException.js";

export interface Input {
  stream: Stream;
  params: ImageProcessorParams;
}

export interface Output {
  stream: Stream;
}

type Exception = ImageProcessingException;

export default interface IImageProcessor {
  processImage(input: Input): Result<Output, Exception>;
}
