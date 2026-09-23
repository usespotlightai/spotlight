const REPLAYED = Symbol('replayed');

export const replayed = <T extends object>(body: T): T =>
  Object.defineProperty(body, REPLAYED, { value: true, enumerable: false });

export const isReplayed = (body: unknown): boolean =>
  typeof body === 'object' && body !== null && REPLAYED in body;
