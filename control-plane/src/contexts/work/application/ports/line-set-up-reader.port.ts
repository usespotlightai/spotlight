import type { TeamId } from '@shared-kernel/domain/value-objects/team-id.vo';

export interface LineSetUp {
  readonly key: string;
  readonly name: string;
  readonly harness: string | null;
  readonly model: string | null;
  readonly effort: string | null;
  readonly repositories: readonly string[];
}

export const LINE_SET_UP_READER = Symbol('LINE_SET_UP_READER');

export interface LineSetUpReaderPort {
  ofTeam(teamId: TeamId): Promise<readonly LineSetUp[]>;
}
