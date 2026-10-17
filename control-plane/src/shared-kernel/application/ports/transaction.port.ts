export const TRANSACTION = Symbol('TRANSACTION');

export interface TransactionPort {
  inTransaction<T>(work: () => Promise<T>): Promise<T>;
}
