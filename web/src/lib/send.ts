export const send: typeof fetch = (input, init) =>
  globalThis.fetch(input, init);
