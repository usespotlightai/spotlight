import type { ChangeStackDrafterPort } from '@change-review/application/ports/change-stack-drafter.port';
import { DraftChangeStack } from '@change-review/application/services/draft-change-stack.service';
import { ReorderChangeStack } from '@change-review/application/services/reorder-change-stack.service';
import { WorkChangeStacks } from '@change-review/application/services/work-change-stacks.service';
import { ChangeStack } from '@change-review/domain/aggregates/change-stack.aggregate';
import type { ChangeStackRepository } from '@change-review/domain/repositories/change-stack.repository';
import { ChangeStackId } from '@change-review/domain/value-objects/change-stack-id.vo';
import {
  Diff,
  type DiffFile,
} from '@change-review/domain/value-objects/diff.vo';
import {
  StackCheck,
  WHOLE_STEP,
} from '@change-review/domain/value-objects/stack-check.vo';
import type { ProposedCohort } from '@change-review/domain/value-objects/stack-cohort.vo';
import { StackFacts } from '@change-review/domain/value-objects/stack-facts.vo';
import { HunkId, LayerId } from '@change-review/domain/value-objects/stack-ids';
import {
  MOST_WORK_ATTEMPTS,
  WORK_LEASE_MS,
} from '@change-review/domain/value-objects/stack-work.vo';
import type { LoggerPort } from '@shared-kernel/application/ports/logger.port';
import { RunId } from '@shared-kernel/domain/value-objects/run-id.vo';
import { WorkspaceId } from '@shared-kernel/domain/value-objects/workspace-id.vo';
import { describe, expect, it, vi } from 'vitest';

const NOW = new Date('2026-09-17T10:00:00Z');
const DAY = 24 * 60 * 60 * 1000;

const changed = (path: string, at: number): DiffFile => ({
  path,
  previousPath: null,
  status: 'modified',
  binary: false,
  hunks: [
    {
      id: HunkId.at(at + 1),
      oldStart: 1,
      oldLines: 1,
      newStart: 1,
      newLines: 1,
      patch: '@@ -1 +1 @@\n-before\n+after',
    },
  ],
});

const layered = (layers: string[][]): ProposedCohort[] => [
  {
    kind: 'change',
    title: 'Invitations',
    intent: 'Invite people',
    joinedBecause: 'The table and the endpoint are one feature',
    layers: layers.map((hunks, at) => ({
      title: `Layer ${at + 1}`,
      summary: `Layer ${at + 1}`,
      dependsOn: [],
      ranges: hunks.map((hunk) => ({ hunk: HunkId.of(hunk) })),
      notes: hunks.map((hunk) => ({
        path: hunk === 'h1' ? 'schema.ts' : 'api.ts',
        note: 'Why it changes',
      })),
    })),
  },
];

const drafting = () =>
  ChangeStack.draft({
    id: ChangeStackId.of('stack-1'),
    runId: RunId.of('run-1'),
    taskId: null,
    workspaceId: WorkspaceId.of('workspace-1'),
    repository: null,
    diff: Diff.of(['schema.ts', 'api.ts'].map(changed)),
    facts: StackFacts.of({
      hunks: ['h1', 'h2'].map((hunk, at) => ({
        hunk: HunkId.of(hunk),
        path: at === 0 ? 'schema.ts' : 'api.ts',
        fileClass: 'source',
        incidental: false,
        renamed: false,
        moved: false,
        linkable: true,
        defines: [],
        outside: [],
      })),
      links: [],
      imports: [],
    }),
    check: StackCheck.named('npx tsc --noEmit'),
    now: NOW,
  });

const QUIET: LoggerPort = {
  debug: () => undefined,
  info: () => undefined,
  warn: () => undefined,
  error: () => undefined,
};

const working = (
  held: ChangeStack,
  answer: () => Promise<readonly ProposedCohort[]>,
) => {
  let stored = held;
  let now = NOW;
  const draft = vi.fn(answer);

  const stacks = {
    find: async () => stored,
    save: async (stack: ChangeStack) => {
      stored = stack;
    },
    dueForWork: async (at: Date) =>
      stored.owesWork && stored.work.dueBy(at) ? stored : null,
  } as unknown as ChangeStackRepository;
  const drafter: ChangeStackDrafterPort = { available: true, draft };
  const clock = { now: () => now, sleep: async () => undefined };

  const service = new WorkChangeStacks(
    stacks,
    { run: (work) => work() },
    new DraftChangeStack(
      stacks,
      drafter,
      {} as never,
      {} as never,
      {} as never,
      { generate: () => 'stack-1' },
      clock,
      QUIET,
    ),
    new ReorderChangeStack(drafter, clock, QUIET),
    clock,
    QUIET,
  );

  const turn = async (at: Date) => {
    now = at;
    await service.workDue();
    await service.idle();
  };

  return { turn, draft, stored: () => stored };
};

describe('WorkChangeStacks', () => {
  it('drafts a stack that is drafting, leasing it while it does', async () => {
    let leasedWhileDrafting = false;
    const worked = working(drafting(), async () => {
      leasedWhileDrafting = !worked.stored().work.dueBy(NOW);
      return layered([['h1'], ['h2']]);
    });

    await worked.turn(NOW);

    expect(leasedWhileDrafting).toBe(true);
    expect(worked.stored().state).toBe('ready');
    expect(worked.stored().owesWork).toBe(false);
  });

  it('tries a failed draft again later rather than at once, then gives up', async () => {
    const worked = working(drafting(), async () => {
      throw new Error('overloaded');
    });

    await worked.turn(NOW);
    await worked.turn(NOW);

    expect(worked.draft).toHaveBeenCalledTimes(1);
    expect(worked.stored().state).toBe('drafting');

    for (let day = 1; day < MOST_WORK_ATTEMPTS; day += 1) {
      await worked.turn(new Date(NOW.getTime() + day * DAY));
    }

    expect(worked.draft).toHaveBeenCalledTimes(MOST_WORK_ATTEMPTS);
    expect(worked.stored().state).toBe('failed');
  });

  it('takes up a draft a restart interrupted once its lease runs out', async () => {
    const worked = working(drafting().leased(NOW), async () =>
      layered([['h1', 'h2']]),
    );

    await worked.turn(new Date(NOW.getTime() + 60_000));
    expect(worked.draft).not.toHaveBeenCalled();

    await worked.turn(new Date(NOW.getTime() + WORK_LEASE_MS + 1));
    expect(worked.stored().state).toBe('ready');
  });

  it('gives up without asking again on work interrupted every time', async () => {
    let interrupted = drafting();
    for (let day = 0; day < MOST_WORK_ATTEMPTS; day += 1) {
      interrupted = interrupted.leased(new Date(NOW.getTime() + day * DAY));
    }
    const worked = working(interrupted, async () => layered([['h1', 'h2']]));

    await worked.turn(new Date(NOW.getTime() + MOST_WORK_ATTEMPTS * DAY));

    expect(worked.draft).not.toHaveBeenCalled();
    expect(worked.stored().state).toBe('failed');
  });

  it('reorders a stack whose layers failed their check', async () => {
    const reordering = drafting()
      .propose(layered([['h1'], ['h2']]), NOW)
      .recordCheck(
        [
          { step: WHOLE_STEP, passed: true, output: '', tookMs: 1 },
          {
            step: LayerId.of('c1.l1'),
            passed: false,
            output: 'TS2304',
            tookMs: 1,
          },
        ],
        NOW,
      );
    const worked = working(reordering, async () => layered([['h2'], ['h1']]));

    await worked.turn(NOW);

    expect(worked.stored().check).toMatchObject({
      phase: 'waiting',
      rounds: 1,
    });
    expect(worked.stored().owesWork).toBe(false);
  });
});
