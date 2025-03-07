import type { Err, Ok } from "./result.types.js";

export function Success(): Ok<void>;
export function Success<const T>(value: T): Ok<T>;
export function Success<const T>(value?: T): Ok<T | void> {
  return { success: true, data: value, error: undefined };
}

export function Failure<const E>(error: E): Err<E> {
  return { success: false, error, data: undefined };
}
