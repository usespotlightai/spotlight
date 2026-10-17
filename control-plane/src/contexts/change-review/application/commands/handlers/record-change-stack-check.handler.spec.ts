import { RecordChangeStackCheckHandler } from '@change-review/application/commands/handlers/record-change-stack-check.handler';
import { RecordChangeStackCheckCommand } from '@change-review/application/commands/record-change-stack-check.command';
import { ChangeStack } from '@change-review/domain/aggregates/change-stack.aggregate';
import { StackCheck } from '@change-review/domain/aggregates/stack-check.aggregate';
import type { ChangeStackRepository } from '@change-review/domain/repositories/change-stack.repository';
import type { StackCheckRepository } from '@change-review/domain/repositories/stack-check.repository';
import { ChangeStackId } from '@change-review/domain/value-objects/change-stack-id.vo';
import { CheckRequest } from '@change-review/domain/value-objects/check-request.vo';
import {
  Diff,
  type DiffFile,
} from '@change-review/domain/value-objects/diff.vo';
import type { ProposedCohort } from '@change-review/domain/value-objects/stack-cohort.vo';
import { StackFacts } from '@change-review/domain/value-objects/stack-facts.vo';
import { HunkId } from '@change-review/domain/value-objects/stack-ids';
import { ApplicationError } from '@shared-kernel/application/errors/application-error';
import { RunId } from '@shared-kernel/domain/value-objects/run-id.vo';
import { RunnerId } from '@shared-kernel/domain/value-objects/runner-id.vo';
import { RunnerTerms } from '@shared-kernel/domain/value-objects/runner-terms.vo';
import { WorkspaceId } from '@shared-kernel/domain/value-objects/workspace-id.vo';
import { describe, expect, it } from 'vitest';

const RUN = 'a1b2c3d4-e5f6-4a7b-8c9d-0e1f2a3b4c5d';

const STACK = 'stack-1';

const NOW = new Date('2026-09-20T10:00:00Z');

const LATER = new Date(NOW.getTime() + 60_000);

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

const DIFF = Diff.of(['schema.ts', 'api.ts'].map(changed));

const cohort = (hunks: string[]): ProposedCohort => ({
  kind: 'change',
  title: 'Invitations',
  intent: 'Invitations',
  layers: hunks.map((hunk) => ({
    title: hunk,
    summary: hunk,
    dependsOn: [],
    ranges: [{ hunk: HunkId.of(hunk) }],
    notes: [{ path: DIFF.fileOf(hunk)?.path ?? hunk, note: 'Why' }],
  })),
});

const ready = () =>
  ChangeStack.draft({
    id: ChangeStackId.of(STACK),
    runId: RunId.of(RUN),
    taskId: null,
    replay: false,
    isSearch: false,
    workspaceId: WorkspaceId.of('ws_1'),
    repository: null,
    base: null,
    diff: DIFF,
    facts: StackFacts.none(),
    request: CheckRequest.of('npm test', null),
    now: NOW,
  }).propose([cohort(['h1', 'h2'])], LATER);

const checkFor = (stack: ChangeStack) =>
  StackCheck.begin({
    stackId: stack.id,
    runId: stack.runId,
    taskId: null,
    replay: false,
    workspaceId: stack.workspaceId,
    request: CheckRequest.of('npm test', null),
    entries: stack.entries(),
    now: LATER,
  });

const recording = (stack: ChangeStack | null, check: StackCheck | null) => {
  const saved: StackCheck[] = [];

  const stacks: ChangeStackRepository = {
    add: async () => undefined,
    save: async () => undefined,
    find: async () => stack,
    dueForWork: async () => null,
    removeForTask: async () => undefined,
    ofRun: async () => [],
  };

  const checks: StackCheckRepository = {
    add: async () => undefined,
    save: async (each) => {
      saved.push(each);
    },
    find: async () => check,
    open: async () => check,
    ofRun: async () => [],
    ofTask: async () => [],
    remove: async () => undefined,
    dueForCheck: async () => null,
    reservedTo: async () => null,
    withExpiredWait: async () => [],
    awaitingProvision: async () => [],
    withExpiredReservations: async () => [],
    waitingIn: async () => [],
  };

  return {
    handler: new RecordChangeStackCheckHandler(checks, stacks, {
      now: () => LATER,
      sleep: async () => {},
    }),
    saved,
  };
};

const reported = (runner: string) =>
  new RecordChangeStackCheckCommand(RUN, runner, STACK, false, null, [
    { step: 'whole', passed: true, output: '', tookMs: 10 },
  ]);

describe('RecordChangeStackCheckHandler', () => {
  it('takes what the runner with the lease on the check found', async () => {
    const stack = ready();
    const leased = checkFor(stack).claimedFor(
      RunnerId.of('runner_1'),
      RunnerTerms.none(),
      LATER,
    );
    const { handler, saved } = recording(stack, leased);

    await handler.execute(reported('runner_1'));

    expect(saved).toHaveLength(1);
    expect(saved[0]?.stateAt(LATER)).toBe('checked');
  });

  it('turns away a runner that does not have the lease on the check as a conflict', async () => {
    const stack = ready();
    const leased = checkFor(stack).claimedFor(
      RunnerId.of('runner_1'),
      RunnerTerms.none(),
      LATER,
    );
    const { handler, saved } = recording(stack, leased);

    await expect(handler.execute(reported('runner_2'))).rejects.toMatchObject({
      kind: 'conflict',
    });
    expect(saved).toEqual([]);
  });

  it('turns away a runner reporting on a check nobody claimed', async () => {
    const stack = ready();
    const { handler, saved } = recording(stack, checkFor(stack));

    await expect(handler.execute(reported('runner_1'))).rejects.toThrow(
      ApplicationError,
    );
    expect(saved).toEqual([]);
  });

  it('turns away a report for a check that is not there', async () => {
    const { handler } = recording(ready(), null);

    await expect(handler.execute(reported('runner_1'))).rejects.toThrow(
      ApplicationError,
    );
  });
});
