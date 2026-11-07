import type { ProposalAccepted } from '@work/domain/events/proposal-accepted.event';
import type { TaskOpened } from '@work/domain/events/task-opened.event';

export interface ProposalAcceptances {
  onProposalAccepted(event: ProposalAccepted): Promise<void>;

  onTaskOpened(event: TaskOpened): Promise<void>;
}
