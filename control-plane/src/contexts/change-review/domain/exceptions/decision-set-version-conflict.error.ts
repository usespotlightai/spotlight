export class DecisionSetVersionConflictError extends Error {
  readonly violation = 'conflict' as const;

  constructor(id: string) {
    super(
      `Decision set ${id} changed since you loaded it. Please reload and try again.`,
    );
    this.name = 'DecisionSetVersionConflictError';
  }
}
