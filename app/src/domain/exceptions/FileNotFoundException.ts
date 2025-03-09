import { AbstractNotFoundException } from "../../shared/exceptions/AbstractNotFoundException.js";

export class FileNotFoundException extends AbstractNotFoundException {
  readonly code = "FILE_NOT_FOUND";
}
