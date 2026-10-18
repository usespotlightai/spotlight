import type {
  RunMemoriesResponseDto,
  RunProposalResponseDto,
  TeamMemoryResponseDto,
} from '@/lib/api';
import { hoursAgo } from '@/mocks/clock';
import { taskOfRun, teamOfTask, world } from '@/mocks/world';
import type { HistoryRun } from '@/mocks/world/insights-history';
import { historyRunOf, lineOfStation } from '@/mocks/world/past-work';
import { MAYA } from '@/mocks/world/people';
import { PLATFORM_ID } from '@/mocks/world/platform';
import { MEMORY_SEED, type MemoryRecord } from '@/mocks/world/team-memories';
import {
  GONE_REMEMBER,
  GONE_THOUGHT,
  provenanceStep,
} from '@/mocks/world/work-stories';

const briefedOf = ({
  harness: _harness,
  steps: _steps,
  notes: _notes,
  ...memory
}: MemoryRecord): TeamMemoryResponseDto => memory;

const seeded = (id: string): TeamMemoryResponseDto => {
  const found = MEMORY_SEED[PLATFORM_ID]?.find((each) => each.id === id);

  if (!found) {
    throw new Error(`No seeded memory ${id}`);
  }

  return briefedOf(found);
};

const BILLING = seeded('memory_billing');
const GONE = seeded('memory_gone');
const STAGING = seeded('memory_staging');
const FLAKY = seeded('memory_flaky');

const proposal = (
  over: Partial<RunProposalResponseDto> & {
    id: string;
    kind: RunProposalResponseDto['kind'];
    body: string;
  },
): RunProposalResponseDto => ({
  source: 'run',
  proposedBy: 'drafter',
  state: 'proposed',
  scope: 'team',
  repository: null,
  paths: [],
  supersedes: null,
  decision: null,
  harness: 'claude-code',
  steps: [],
  notes: [],
  handle: null,
  status: null,
  ...over,
});

const NOTHING: RunMemoriesResponseDto = {
  briefed: [],
  omitted: [],
  recalled: [],
  proposed: [],
  reviewItemId: null,
};

const RUN_MEMORIES: Record<string, Partial<RunMemoriesResponseDto>> = {
  run_checkout_1: { recalled: [FLAKY] },
  run_retries_2: {
    briefed: [STAGING],
    proposed: [
      proposal({
        id: GONE.id,
        kind: GONE.kind,
        body: GONE.body,
        scope: GONE.scope,
        repository: GONE.repository,
        paths: GONE.paths,
        state: 'approved',
        decision: { by: MAYA.id, name: MAYA.name, at: GONE.approvedAt },
        handle: GONE.handle,
        status: 'active',
        steps: [
          provenanceStep('run_retries_2', GONE_THOUGHT),
          provenanceStep('run_retries_2', GONE_REMEMBER, 'remember'),
        ],
      }),
    ],
  },
  run_retries_3: { briefed: [GONE, STAGING], recalled: [BILLING] },
  run_billing_1: {
    proposed: [
      proposal({
        id: 'proposal_billing_database',
        kind: 'environment',
        body: 'Runners cannot reach the billing database at 10.0.4.12, so the invoice reconcile script cannot run from Spotlight.',
        steps: [
          provenanceStep(
            'run_billing_1',
            'The reconcile script cannot reach the billing database from the runner.',
          ),
        ],
        scope: 'line',
        state: 'rejected',
        decision: { by: MAYA.id, name: MAYA.name, at: hoursAgo(18) },
      }),
    ],
  },
};

const MAX_BRIEFED = 4;

const activeAt = (memory: MemoryRecord, at: string): boolean =>
  memory.approvedAt <= at &&
  (memory.retirement === null || memory.retirement.at > at);

type RunContext = Pick<
  HistoryRun,
  'teamId' | 'lineId' | 'stationId' | 'repositories'
> & { readonly startedAt: string };

const matches = (memory: MemoryRecord, run: RunContext): boolean =>
  (memory.lineId === null || memory.lineId === run.lineId) &&
  (memory.stationId === null || memory.stationId === run.stationId) &&
  (memory.repository === null ||
    run.repositories.length === 0 ||
    run.repositories.includes(memory.repository));

const contextOfRun = (runId: string): RunContext | undefined => {
  const past = historyRunOf(runId);
  if (past?.startedAt) {
    return { ...past, startedAt: past.startedAt };
  }
  const taskId = taskOfRun(runId);
  const teamId = taskId ? teamOfTask(taskId) : undefined;
  const run = taskId
    ? world().runs[taskId]?.find((each) => each.id === runId)
    : undefined;
  const stationId = run?.station?.id ?? '';
  const lineId = lineOfStation(stationId)?.id;

  return teamId && run && lineId
    ? { teamId, lineId, stationId, repositories: [], startedAt: run.startedAt }
    : undefined;
};

const briefedFor = (runId: string): TeamMemoryResponseDto[] => {
  const run = contextOfRun(runId);

  return run
    ? (MEMORY_SEED[run.teamId] ?? [])
        .filter(
          (memory) => activeAt(memory, run.startedAt) && matches(memory, run),
        )
        .slice(0, MAX_BRIEFED)
        .map(briefedOf)
    : [];
};

export const runMemoriesOf = (runId: string): RunMemoriesResponseDto => ({
  ...NOTHING,
  briefed: briefedFor(runId),
  ...RUN_MEMORIES[runId],
});
