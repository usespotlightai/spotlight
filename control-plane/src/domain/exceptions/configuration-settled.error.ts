export class ConfigurationSettledError extends Error {
  readonly violation = 'invalid' as const;

  constructor(held: string) {
    super(
      `This team already keeps its configuration in ${held}, and where it is kept cannot be changed`,
    );
    this.name = 'ConfigurationSettledError';
  }
}
