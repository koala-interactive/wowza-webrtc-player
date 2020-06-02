export function deferred<T>(): TDeferred<T> {
  const output = {} as TDeferred<T>;

  output.promise = new Promise((resolve, reject) => {
    output.resolve = resolve;
    output.reject = reject;
  });

  return output;
}
