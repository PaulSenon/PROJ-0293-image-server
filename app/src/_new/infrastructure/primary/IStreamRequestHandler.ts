import type Stream from "stream";

export interface IStreamRequestHandler<TReq, TRes extends Stream> {
  handle(event: TReq, responseStream: TRes): Promise<void>;
}
