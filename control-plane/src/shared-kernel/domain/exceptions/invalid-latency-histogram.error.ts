export class InvalidLatencyHistogramError extends Error {
  readonly violation = 'invalid' as const;

  constructor(reason: string) {
    super(`Latency histogram ${reason}.`);
    this.name = 'InvalidLatencyHistogramError';
  }
}
