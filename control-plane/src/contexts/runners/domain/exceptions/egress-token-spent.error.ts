export class EgressTokenSpentError extends Error {
  readonly violation = 'invalid' as const;

  readonly field = 'token';

  readonly because = 'was used before. Egress tokens work once only';

  constructor() {
    super('Egress token was used before. Please give a new one.');
    this.name = 'EgressTokenSpentError';
  }
}
