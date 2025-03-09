import type { Stream, Uri } from "../../../shared/domainObjects.types.js";
import type { Result } from "../../../shared/utils/Result/result.types.js";
import type { FileNotFoundException } from "../../exceptions/FileNotFoundException.js";

export interface Input {
  uri: Uri;
}

export interface Output {
  stream: Stream;
}

export default interface IFileBodyStreamLoader {
  loadFileBodyStream(
    input: Input
  ): Promise<Result<Output, FileNotFoundException>>;
}
