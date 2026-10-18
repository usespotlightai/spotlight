export class HookAlreadyExistsError extends Error {
  readonly kind = 'conflict' as const;

  constructor(key: string) {
    super(
      `A hook named ${key} already exists in this team. Please choose another name.`,
    );
    this.name = 'HookAlreadyExistsError';
  }
}
