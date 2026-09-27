export const ISOLATION = Symbol('ISOLATION');

export interface IsolationPort {
  isolated<T>(work: () => Promise<T>): Promise<T>;
}
