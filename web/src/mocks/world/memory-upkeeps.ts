import type {
  MemoryUpkeepResponseDto,
  TeamMemoryResponseDto,
  UpkeepProposalResponseDto,
} from '@/lib/api';
import { hoursAgo } from '@/mocks/clock';
import { PLATFORM_ID, perWorld } from '@/mocks/world';
import { MEMORY_SEED } from '@/mocks/world/team-memories';

export const UPKEEP_ID = 'upkeep_weekly';

const named = (id: string) => {
  const found = MEMORY_SEED[PLATFORM_ID]?.find(
    (each) => each.id === id,
  ) as TeamMemoryResponseDto;

  return {
    id: found.id,
    handle: found.handle,
    kind: found.kind,
    body: found.body,
    status: found.status,
  };
};

const proposal = (
  over: Pick<
    UpkeepProposalResponseDto,
    'id' | 'change' | 'finding' | 'reason' | 'memories'
  > &
    Partial<UpkeepProposalResponseDto>,
): UpkeepProposalResponseDto => ({
  state: 'pending',
  body: null,
  decidedBy: null,
  decidedAt: null,
  inactiveMemories: [],
  ...over,
});

const seed = (): Record<string, MemoryUpkeepResponseDto> => ({
  [UPKEEP_ID]: {
    id: UPKEEP_ID,
    teamId: PLATFORM_ID,
    sweptAt: hoursAgo(2),
    proposals: [
      proposal({
        id: 'p_1',
        change: 'retire',
        finding: 'unused',
        reason:
          'Approved 120 days ago and no run has used it in the last 90 days.',
        memories: [named('memory_staging')],
      }),
      proposal({
        id: 'p_2',
        change: 'merge',
        finding: 'overlap',
        reason:
          'Both tell a run which retry queue to drain and which deliveries to drop.',
        memories: [named('memory_billing'), named('memory_gone')],
        body: 'Drain webhook-retries first and leave billing-retries alone while billing is being reconciled; a 410 Gone is permanent, so drop those deliveries rather than retry them.',
      }),
      proposal({
        id: 'p_3',
        change: 'retire',
        finding: 'path-gone',
        reason: 'acme/api no longer has any path this memory names.',
        memories: [named('memory_precision')],
      }),
    ],
  },
});

export const memoryUpkeeps = perWorld(
  (kind): Record<string, MemoryUpkeepResponseDto> =>
    kind === 'empty' ? {} : seed(),
);
