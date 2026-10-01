export class InvalidLatencyHistogramError extends Error {
  readonly violation = 'invalid' as const;

  constructor(reason: string) {
    super(`A latency histogram ${reason}`);
    this.name = 'InvalidLatencyHistogramError';
  }
}
