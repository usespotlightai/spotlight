export class InvalidLatencyHistogramError extends Error {
  readonly kind = 'invalid' as const;

  constructor(reason: string) {
    super(`Latency histogram ${reason}.`);
    this.name = 'InvalidLatencyHistogramError';
  }
}
