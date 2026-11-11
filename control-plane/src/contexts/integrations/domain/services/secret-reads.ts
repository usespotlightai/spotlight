const READS_A_SECRET = /(^|[^A-Za-z0-9_.])secret\s*(\.|\[)/;

export const readsASecret = (expression: string): boolean =>
  READS_A_SECRET.test(expression);
