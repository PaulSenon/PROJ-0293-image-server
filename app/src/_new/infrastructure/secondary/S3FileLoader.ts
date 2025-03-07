import {
  GetObjectCommand,
  HeadObjectCommand,
  NoSuchBucket,
  NoSuchKey,
  NotFound,
  type S3Client,
} from "@aws-sdk/client-s3";
import type IFileBodyStreamLoader from "../../domain/ports/secondary/IFileBodyStreamLoader.js";
import type {
  Input as IFileBodyStreamLoaderInput,
  Output as IFileBodyStreamLoaderOutput,
} from "../../domain/ports/secondary/IFileBodyStreamLoader.js";
import type IFileMetaLoader from "../../domain/ports/secondary/IFileMetaLoader.js";
import type {
  Input as IFileMetaLoaderInput,
  Output as IFileMetaLoaderOutput,
} from "../../domain/ports/secondary/IFileMetaLoader.js";
import { Readable } from "stream";
import {
  FileMetaSchema,
  type FileMeta,
} from "../../shared/dto/FileMeta.dto.js";
import type { Result } from "../../shared/utils/Result/result.types.js";
import { FileNotFoundException } from "../../domain/exceptions/FileNotFoundException.js";
import { Failure, Success } from "../../shared/utils/Result/result.js";

interface Params {
  s3Client: S3Client;
  bucketName: string;
}

export default class S3FileLoader
  implements IFileBodyStreamLoader, IFileMetaLoader
{
  private readonly s3Client: S3Client;
  private readonly bucketName: string;

  constructor(params: Params) {
    this.s3Client = params.s3Client;
    this.bucketName = params.bucketName;
  }

  async loadFileBodyStream(
    input: IFileBodyStreamLoaderInput
  ): Promise<Result<IFileBodyStreamLoaderOutput, FileNotFoundException>> {
    const { uri } = input;

    const command = new GetObjectCommand({
      Bucket: this.bucketName,
      Key: uri,
    });

    try {
      const response = await this.s3Client.send(command);
      if (response.Body === undefined) throw new Error("No body in response");
      if (!(response.Body instanceof Readable))
        throw new Error("Body is not a stream");

      return Success({
        stream: response.Body,
      });
    } catch (error) {
      if (
        error instanceof NotFound ||
        error instanceof NoSuchBucket ||
        error instanceof NoSuchKey
      ) {
        const notFoundException = new FileNotFoundException({
          publicMessage: "File not found",
          privateMessage: error.message,
        });
        return Failure(notFoundException);
      }
      throw error;
    }
  }

  async loadFileMeta(
    input: IFileMetaLoaderInput
  ): Promise<Result<IFileMetaLoaderOutput, FileNotFoundException>> {
    const { uri } = input;

    const command = new HeadObjectCommand({
      Bucket: this.bucketName,
      Key: uri,
    });

    try {
      const response = await this.s3Client.send(command);

      const metadata: FileMeta = await FileMetaSchema.parseAsync({
        byteLength: response.ContentLength,
        contentType: response.ContentType,
        eTag: response.ETag,
        lastModified: response.LastModified,
      });

      return Success(metadata);
    } catch (error) {
      if (
        error instanceof NotFound ||
        error instanceof NoSuchBucket ||
        error instanceof NoSuchKey
      ) {
        const notFoundException = new FileNotFoundException({
          publicMessage: "File not found",
          privateMessage: error.message,
        });
        return Failure(notFoundException);
      }
      throw error;
    }
  }
}
