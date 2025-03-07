export type Ok<T> = {
  success: true;
  data: T;
  error: void;
};

export type Err<E> = {
  success: false;
  error: E;
  data: void;
};

export type Result<T, E = Error> = Ok<T> | Err<E>;
