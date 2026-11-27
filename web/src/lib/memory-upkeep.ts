import type {
  MemoryUpkeepResponseDto,
  UpkeepProposalResponseDto,
} from '@/lib/api';
import type { ApprovalStatus } from '@/lib/approval-status';
import { teamSectionPath } from '@/lib/team';

export type MemoryUpkeep = MemoryUpkeepResponseDto;

export type UpkeepProposal = UpkeepProposalResponseDto;

export type UpkeepDecision = 'approved' | 'rejected';

export const memoryUpkeepPath = (
  slug: string,
  teamId: string,
  upkeepId: string,
): string => `${teamSectionPath(slug, teamId, 'memory')}/upkeep/${upkeepId}`;

const FINDINGS: Record<UpkeepProposal['finding'], string> = {
  'path-gone': 'The paths it names are gone',
  'repository-gone': 'The team no longer works in its repository',
  unused: 'No run used it in 90 days',
  wrong: 'Another memory says otherwise',
  overlap: 'These memories say the same thing',
};

export const findingOf = (proposal: UpkeepProposal): string =>
  FINDINGS[proposal.finding];

const handles = (proposal: UpkeepProposal): string =>
  proposal.memories.map((each) => each.handle).join(', ');

const PAST: Record<UpkeepProposal['change'], string> = {
  retire: 'Retired',
  merge: 'Merged',
};

export const changeTitleOf = (proposal: UpkeepProposal): string => {
  const named = handles(proposal);

  if (proposal.state === 'pending') {
    return proposal.change === 'merge'
      ? `Merge ${named} into one`
      : `Retire ${named}`;
  }

  if (proposal.state === 'lapsed') {
    return `No longer applies to ${named}`;
  }

  const done =
    proposal.state === 'approved'
      ? `${PAST[proposal.change]} ${named}`
      : `Kept ${named}`;
  const who = proposal.decidedBy?.name;

  return who !== undefined && who !== null && who !== ''
    ? `${done} by ${who}`
    : done;
};

const STATUSES: Record<UpkeepProposal['state'], ApprovalStatus> = {
  pending: 'pending',
  approved: 'approved',
  rejected: 'dismissed',
  lapsed: 'dismissed',
};

export const changeStatusOf = (proposal: UpkeepProposal): ApprovalStatus =>
  STATUSES[proposal.state];

export const stillPending = (upkeep: MemoryUpkeep): number =>
  upkeep.proposals.filter((each) => each.state === 'pending').length;
