export class EgressAlreadyDefinedError extends Error {
  readonly violation = 'conflict' as const;

  constructor(key: string) {
    super(`An egress keyed ${key} already exists. Please choose another key.`);
    this.name = 'EgressAlreadyDefinedError';
  }
}
