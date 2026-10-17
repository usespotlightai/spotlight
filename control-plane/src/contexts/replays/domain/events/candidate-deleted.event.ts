import type { CandidateId } from '@replays/domain/value-objects/candidate-id.vo';
import type { ConfigurationChanged } from '@shared-kernel/domain/events/configuration-changed';
import type { ConfigurationChange } from '@shared-kernel/domain/value-objects/configuration-change.vo';
import type { TeamId } from '@shared-kernel/domain/value-objects/team-id.vo';

export class CandidateDeleted implements ConfigurationChanged {
  readonly kind = 'replays.candidate-deleted';

  constructor(
    readonly candidateId: CandidateId,
    readonly teamId: TeamId,
    readonly change: ConfigurationChange,
  ) {}
}
