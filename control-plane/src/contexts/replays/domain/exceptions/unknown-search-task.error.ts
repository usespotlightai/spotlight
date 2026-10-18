export class UnknownSearchTaskError extends Error {
  readonly kind = 'not-found' as const;

  constructor(taskId: string) {
    super(
      `No failing task ${taskId} among the tasks this reflection looks into; record causes only for the tasks its briefing lists`,
    );
    this.name = 'UnknownSearchTaskError';
  }
}
