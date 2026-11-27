export const partial = <T>(implemented: Partial<T>): T =>
  // oxlint-disable-next-line typescript/no-unsafe-type-assertion
  implemented as T;
