import type { ProposalAccepted } from '@domain/events/proposal-accepted.event';

export interface ProposalAcceptances {
  onProposalAccepted(event: ProposalAccepted): Promise<void>;
}
