import type { ConfigurationFile } from '@shared-kernel/domain/value-objects/configuration-file.vo';
import type { TeamId } from '@shared-kernel/domain/value-objects/team-id.vo';
import type { ProposedChangeDto } from '@work/application/dto/proposed-change.dto';

export const CONFIGURATION_PROPOSALS = Symbol('CONFIGURATION_PROPOSALS');

export interface Pending {
  readonly onBranch: boolean;
  readonly files: readonly ConfigurationFile[];
}

export interface Proposal {
  readonly title: string;
  readonly body: string;
  readonly files: readonly ConfigurationFile[];
  readonly removes?: readonly string[];
}

export interface ConfigurationProposalsPort {
  pendingUnder(teamId: TeamId, path: string): Promise<Pending | null>;

  propose(
    teamId: TeamId,
    proposal: Proposal,
  ): Promise<ProposedChangeDto | null>;

  seed(teamId: TeamId, proposal: Proposal): Promise<ProposedChangeDto | null>;
}
