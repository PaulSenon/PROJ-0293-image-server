import type { FileMeta } from "../../../shared/dto/FileMeta.dto.js";
import type { Uri } from "../../../shared/domainObjects.types.js";
import type { Result } from "../../../shared/utils/Result/result.types.js";
import type { FileNotFoundException } from "../../exceptions/FileNotFoundException.js";

export interface Input {
  uri: Uri;
}

export type Output = FileMeta;

export default interface IFileMetaLoader {
  loadFileMeta(input: Input): Promise<Result<Output, FileNotFoundException>>;
}
