export class PersonToolPolicyVersionConflictError extends Error {
  readonly kind = 'conflict' as const;

  constructor(integration: string) {
    super(
      `Your rules for the ${integration} tools changed in another request. Please reload and try again.`,
    );
    this.name = 'PersonToolPolicyVersionConflictError';
  }
}
