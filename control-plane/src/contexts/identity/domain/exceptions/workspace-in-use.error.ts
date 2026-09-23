import type { TeamKey } from '@identity/domain/value-objects/team-key.vo';

export class WorkspaceInUseError extends Error {
  readonly violation = 'conflict' as const;

  constructor(slug: string, teams: readonly TeamKey[]) {
    super(
      `The ${slug} workspace still holds ${
        teams.length > 0
          ? `the teams ${teams.map((each) => each.value).join(', ')}`
          : 'a team'
      }; delete them first`,
    );
    this.name = 'WorkspaceInUseError';
  }
}
