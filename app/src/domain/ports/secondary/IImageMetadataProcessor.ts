import type { ImageMetadata } from "../../../shared/dto/ImageMetadataOutput.dto.js";
import type { Stream } from "../../../shared/domainObjects.types.js";
import type { Result } from "../../../shared/utils/Result/result.types.js";
import type { ImageProcessingException } from "../../exceptions/ImageProcessingException.js";

export interface Input {
  stream: Stream;
}

export interface Output {
  metadata: ImageMetadata;
}

type Exception = ImageProcessingException;

export default interface IImageMetadataProcessor {
  processImageMetadata(input: Input): Promise<Result<Output, Exception>>;
}
