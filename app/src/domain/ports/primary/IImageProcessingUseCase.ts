import type { ETag, Stream } from "../../../shared/domainObjects.types.js";
import type {
  RawRequestHeaders,
  RawRequestParams,
} from "../../../shared/dto/Request.dto.js";
import type { IUseCase } from "../../../shared/utils/useCase.types.js";
import type { FileNotFoundException } from "../../exceptions/FileNotFoundException.js";
import type { ImageProcessingException } from "../../exceptions/ImageProcessingException.js";
import type { InvalidParamException } from "../../exceptions/InvalidParamException.js";

// do not export
export type Input = {
  rawParams: RawRequestParams;
  rawHeaders: RawRequestHeaders;
};

export type ProcessedOutput = {
  type: "processed";
  stream: Stream;
  // this is just some minimal additional data we need to create the response
  headers: {
    contentType: string;
    eTag: ETag;
  };
};
export type UnmodifiedOutput = {
  type: "unmodified";
};
export type Output = ProcessedOutput | UnmodifiedOutput;

export type Exception =
  | FileNotFoundException
  | ImageProcessingException
  | InvalidParamException;

export interface IImageProcessingUseCase
  extends IUseCase<Input, Output, Exception> {}
