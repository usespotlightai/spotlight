export class RunGrantsEndedError extends Error {
  readonly violation = 'not-allowed' as const;

  constructor(runId: string) {
    super(
      `Run ${runId} has ended, and with it every secret it was granted; nothing more is granted to it`,
    );
    this.name = 'RunGrantsEndedError';
  }
}
