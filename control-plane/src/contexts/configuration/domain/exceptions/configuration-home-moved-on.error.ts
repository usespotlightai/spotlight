export class ConfigurationHomeMovedOnError extends Error {
  readonly violation = 'conflict' as const;

  constructor(teamId: string) {
    super(
      `Where this team keeps its configuration has been changed since it was read, and cannot be written over (${teamId})`,
    );
    this.name = 'ConfigurationHomeMovedOnError';
  }
}
