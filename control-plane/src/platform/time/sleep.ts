export type Sleep = (ms: number) => Promise<void>;

export const sleeping: Sleep = (ms) =>
  new Promise((done) => setTimeout(done, ms).unref());
