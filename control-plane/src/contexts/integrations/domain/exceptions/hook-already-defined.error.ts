export class HookAlreadyDefinedError extends Error {
  readonly violation = 'conflict' as const;

  constructor(key: string) {
    super(
      `A hook named ${key} already exists in this team. Please choose another name.`,
    );
    this.name = 'HookAlreadyDefinedError';
  }
}
