export class PersonToolPolicyVersionConflictError extends Error {
  readonly violation = 'conflict' as const;

  constructor(source: string) {
    super(
      `Your rules for the ${source} tools changed in another request. Please reload and try again.`,
    );
    this.name = 'PersonToolPolicyVersionConflictError';
  }
}
