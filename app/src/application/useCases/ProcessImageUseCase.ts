import type {
  IImageProcessingUseCase,
  Output,
  Input,
  Exception,
} from "../../domain/ports/primary/IImageProcessingUseCase.js";
import type IImageMetadataProcessor from "../../domain/ports/secondary/IImageMetadataProcessor.js";
import type IImageProcessor from "../../domain/ports/secondary/IImageProcessor.js";
import type IFileMetaLoader from "../../domain/ports/secondary/IFileMetaLoader.js";
import type IFileBodyStreamLoader from "../../domain/ports/secondary/IFileBodyStreamLoader.js";
import type { Result } from "../../shared/utils/Result/result.types.js";
import {
  type ImageProcessorParams,
  type OutputFormat,
} from "../../shared/dto/ImageProcessorParams.dto.js";
import { InvalidParamException } from "../../domain/exceptions/InvalidParamException.js";
import { Failure, Success } from "../../shared/utils/Result/result.js";
import { PassThrough } from "stream";
import type { Stream } from "../../shared/domainObjects.types.js";
import type { FileMeta } from "../../shared/dto/FileMeta.dto.js";
import {
  RawRequestHeadersSchema,
  RawRequestParamsSchema,
  type RefinedRequestHeaders,
  type RefinedRequestParams,
} from "../../shared/dto/Request.dto.js";

interface Params {
  imageProcessor: IImageProcessor;
  imageMetadataProcessor: IImageMetadataProcessor;
  fileMetaLoader: IFileMetaLoader;
  fileBodyStreamLoader: IFileBodyStreamLoader;
}

export default class ProcessImageUseCase implements IImageProcessingUseCase {
  private imageProcessor: IImageProcessor;
  private imageMetadataProcessor: IImageMetadataProcessor;
  private fileMetaLoader: IFileMetaLoader;
  private fileBodyStreamLoader: IFileBodyStreamLoader;

  constructor(params: Params) {
    this.imageProcessor = params.imageProcessor;
    this.imageMetadataProcessor = params.imageMetadataProcessor;
    this.fileMetaLoader = params.fileMetaLoader;
    this.fileBodyStreamLoader = params.fileBodyStreamLoader;
  }

  async execute(input: Input): Promise<Result<Output, Exception>> {
    const { rawHeaders, rawParams } = input;

    // 1. parse raw params
    const refinedParamsResult = await RawRequestParamsSchema.safeParseAsync(
      rawParams
    );
    if (!refinedParamsResult.success) {
      return Failure(
        new InvalidParamException({
          publicMessage: `Invalid param [${refinedParamsResult.error.message}]`,
        })
      );
    }
    const params = refinedParamsResult.data;
    const { uri, meta } = params;
    const refinedHeadersResult = await RawRequestHeadersSchema.safeParseAsync(
      rawHeaders
    );
    if (!refinedHeadersResult.success) {
      return Failure(
        new InvalidParamException({
          publicMessage: `Invalid header [${refinedHeadersResult.error.message}]`,
        })
      );
    }
    const headers = refinedHeadersResult.data;

    console.log(`image requested: ${uri}`, {
      params,
      headers,
    });

    const outputStream = new PassThrough();
    // 1. file not changed
    const fileMetaResult = await this.fileMetaLoader.loadFileMeta({ uri });
    if (!fileMetaResult.success) return Failure(fileMetaResult.error);
    const fileMeta = fileMetaResult.data;
    if (headers.ifNoneMatch === fileMeta.eTag) {
      // 1. process raw type => output format
      const outputFormatResult = this.getOutputFormat({
        headers,
        params,
      });
      if (!outputFormatResult.success) return Failure(outputFormatResult.error);
      const outputFormat = outputFormatResult.data;
      console.log(`return unmodified: ${uri}`);
      return Success({
        type: "unmodified",
        headers: {
          eTag: fileMeta.eTag,
          contentType: outputFormat,
        },
      });
    }

    // 2. file changed
    // setup input stream from source uri
    const inputStreamResult =
      await this.fileBodyStreamLoader.loadFileBodyStream({
        uri,
      });
    if (!inputStreamResult.success) return Failure(inputStreamResult.error);
    const inputStream = inputStreamResult.data.stream;

    if (meta) {
      // 2.2. metadata requested
      console.log(`handle metadata request: ${uri}`);
      return this.handleMetadataRequest({
        inputStream,
        outputStream,
        fileMeta,
      });
    } else {
      // 2.3. image processing requested
      console.log(`handle image processing request: ${uri}`);
      return this.handleImageProcessingRequest({
        inputStream,
        outputStream,
        input: {
          params,
          headers,
        },
        fileMeta,
      });
    }
  }

  private async handleMetadataRequest(params: {
    inputStream: Stream;
    outputStream: PassThrough;
    fileMeta: FileMeta;
  }): Promise<Result<Output, Exception>> {
    const { inputStream, outputStream, fileMeta } = params;
    const metadataResult =
      await this.imageMetadataProcessor.processImageMetadata({
        stream: inputStream,
      });
    if (!metadataResult.success) return Failure(metadataResult.error);
    const metadata = metadataResult.data.metadata;
    outputStream.write(JSON.stringify(metadata));
    outputStream.end();
    return Success({
      type: "processed",
      stream: outputStream,
      headers: {
        eTag: fileMeta.eTag,
        contentType: "application/json",
      },
    });
  }

  private async handleImageProcessingRequest(params: {
    inputStream: Stream;
    outputStream: PassThrough;
    input: {
      params: RefinedRequestParams;
      headers: RefinedRequestHeaders;
    };
    fileMeta: FileMeta;
  }): Promise<Result<Output, Exception>> {
    const { inputStream, outputStream, input, fileMeta } = params;
    const { w, h, q } = input.params;

    // 1. process raw type => output format
    const outputFormatResult = this.getOutputFormat(input);
    if (!outputFormatResult.success) return Failure(outputFormatResult.error);
    const outputFormat = outputFormatResult.data;

    // 2. get output content type
    const outputContentType = this.getOutputContentType({
      outputFormat,
      fileMeta,
    });

    // 3. process image
    const processingParams: ImageProcessorParams = {
      width: w,
      height: h ?? undefined,
      quality: q ?? 85,
      outputFormat,
      allowUpscale: false,
      fit: "cover",
      sharpen: true,
    };
    const processedImageResult = this.imageProcessor.processImage({
      stream: inputStream,
      params: processingParams,
    });
    if (!processedImageResult.success) {
      return Failure(processedImageResult.error);
    }
    const processedImageStream = processedImageResult.data.stream;

    processedImageStream.on("close", () => {
      console.log(`processing closed`);
    });
    processedImageStream.on("error", (error) => {
      console.error(`processing error:`, error);
    });

    // 4. write processed image to output stream
    processedImageStream.pipe(outputStream);

    return Success({
      type: "processed",
      stream: outputStream,
      headers: {
        eTag: fileMeta.eTag,
        contentType: outputContentType,
      },
    });
  }

  private getOutputContentType(params: {
    outputFormat: OutputFormat;
    fileMeta: FileMeta;
  }): string {
    const { outputFormat, fileMeta } = params;
    if (outputFormat === "matchSource") return fileMeta.contentType;
    else return `image/${outputFormat}`;
  }

  private getOutputFormat(input: {
    params: RefinedRequestParams;
    headers: RefinedRequestHeaders;
  }): Result<OutputFormat, InvalidParamException> {
    const { params, headers } = input;
    const { type: imageType } = params;
    const { accept } = headers;

    // 1. type is provided
    if (imageType) return Success(imageType);

    // 2. type is not provided, but headerAccept is provided
    if (!imageType && accept) {
      if (accept.includes("image/avif")) return Success("avif");
      else if (accept.includes("image/webp")) return Success("webp");
    }

    // 3. fallback to matchSource
    return Success("matchSource");
  }
}
