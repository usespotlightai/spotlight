export class RunHoldOverError extends Error {
  readonly violation = 'not-allowed' as const;

  constructor(runId: string, attempt: number) {
    super(
      `Run ${runId} no longer holds attempt ${attempt}, and with it every secret that attempt was granted; nothing more is granted to it`,
    );
    this.name = 'RunHoldOverError';
  }
}
