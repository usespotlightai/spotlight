export class EgressAlreadyExistsError extends Error {
  readonly kind = 'conflict' as const;

  constructor(key: string) {
    super(`An egress keyed ${key} already exists. Please choose another key.`);
    this.name = 'EgressAlreadyExistsError';
  }
}
