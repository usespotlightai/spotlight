export class WorkloadNotMatchedError extends Error {
  constructor(key: string) {
    super(`Token trust ${key} does not match this workload.`);
    this.name = 'WorkloadNotMatchedError';
  }
}
