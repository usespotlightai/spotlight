export const TRANSACTION = Symbol('TRANSACTION');

export interface TransactionPort {
  run<T>(work: () => Promise<T>): Promise<T>;
}
