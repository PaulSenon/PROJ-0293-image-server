import type { Result } from "./Result/result.types.js";
import type { OptionalPromise } from "./Promise/promise.types.js";
import type { AbstractException } from "../exceptions/AbstractException.js";

export interface IUseCase<TInput, TOutput, TException = AbstractException> {
  execute(input: TInput): OptionalPromise<Result<TOutput, TException>>;
}

export type UCOutput<TUc extends IUseCase<unknown, unknown>> =
  TUc extends IUseCase<unknown, infer TOutput> ? TOutput : never;

export type UCInput<TUc extends IUseCase<unknown, unknown>> =
  TUc extends IUseCase<infer TInput, unknown> ? TInput : never;

export type UCException<TUc extends IUseCase<unknown, unknown, unknown>> =
  TUc extends IUseCase<unknown, unknown, infer TException> ? TException : never;
