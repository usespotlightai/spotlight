export class TeamAlreadyExistsError extends Error {
  readonly kind = 'conflict' as const;

  constructor(key: string) {
    super(`A team with key ${key} already exists. Please choose another key.`);
    this.name = 'TeamAlreadyExistsError';
  }
}
