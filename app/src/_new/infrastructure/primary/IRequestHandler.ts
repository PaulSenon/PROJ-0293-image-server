export interface IRequestHandler<TReq, TRes> {
  handle(event: TReq): Promise<TRes>;
}
