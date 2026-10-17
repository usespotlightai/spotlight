export class InferredOutputSchemaVersionConflictError extends Error {
  readonly violation = 'conflict' as const;

  constructor(tool: string) {
    super(
      `Another call inferred what ${tool} answers at the same time. Please try again.`,
    );
    this.name = 'InferredOutputSchemaVersionConflictError';
  }
}
