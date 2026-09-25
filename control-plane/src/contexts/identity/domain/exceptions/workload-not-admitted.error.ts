export class WorkloadNotAdmittedError extends Error {
  constructor(key: string) {
    super(`The ${key} token trust does not admit that workload`);
    this.name = 'WorkloadNotAdmittedError';
  }
}
