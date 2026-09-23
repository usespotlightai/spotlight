export class InvalidTeamNameError extends Error {
  readonly violation = 'invalid' as const;

  constructor(readonly because: string) {
    super(`A team name ${because}`);
    this.name = 'InvalidTeamNameError';
  }
}
