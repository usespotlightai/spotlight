export class LineAlreadyExistsError extends Error {
  readonly kind = 'conflict' as const;

  constructor(key: string) {
    super(`A line with key ${key} already exists in this team.`);
    this.name = 'LineAlreadyExistsError';
  }
}
