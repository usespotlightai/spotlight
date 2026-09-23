export class TeamAlreadyDefinedError extends Error {
  readonly violation = 'conflict' as const;

  constructor(key: string) {
    super(`The workspace already has a team keyed ${key}`);
    this.name = 'TeamAlreadyDefinedError';
  }
}
