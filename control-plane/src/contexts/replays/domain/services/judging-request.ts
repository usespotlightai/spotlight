import type { Candidate } from '@replays/domain/aggregates/candidate.aggregate';
import type { JudgeCriteria } from '@shared-kernel/domain/value-objects/judge-criteria.vo';
import type { TeamId } from '@shared-kernel/domain/value-objects/team-id.vo';

export type JudgingRequest =
  | {
      readonly judged: true;
      readonly teamId: TeamId;
      readonly criteria: JudgeCriteria;
    }
  | { readonly judged: false; readonly failure: 'unreadable-rubric' };

export const judgingRequestOf = (candidate: Candidate | null): JudgingRequest =>
  candidate?.judge
    ? { judged: true, teamId: candidate.teamId, criteria: candidate.judge }
    : { judged: false, failure: 'unreadable-rubric' };
