export class PersonToolPolicyMovedOnError extends Error {
  readonly violation = 'conflict' as const;

  constructor(source: string) {
    super(
      `Your rules for the ${source} tools changed in another request meanwhile`,
    );
    this.name = 'PersonToolPolicyMovedOnError';
  }
}
