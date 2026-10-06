export class WorkloadNotAdmittedError extends Error {
  constructor(key: string) {
    super(`Token trust ${key} does not admit this workload.`);
    this.name = 'WorkloadNotAdmittedError';
  }
}
