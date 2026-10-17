export const SAVEPOINT = Symbol('SAVEPOINT');

export interface SavepointPort {
  inSavepoint<T>(work: () => Promise<T>): Promise<T>;
}
