export class InvalidTeamNameError extends Error {
  readonly violation = 'invalid' as const;

  constructor(reason: string) {
    super(`A team name ${reason}`);
    this.name = 'InvalidTeamNameError';
  }
}
