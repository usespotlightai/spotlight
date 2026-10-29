import { FakeWork } from '@replays/application/services/replays.fake-spec';
import { SearchFindings } from '@replays/application/services/search-findings.service';
import type { Search } from '@replays/domain/aggregates/search.aggregate';
import {
  FailureCause,
  type FailureCauseKind,
} from '@replays/domain/value-objects/failure-cause.vo';
import { ReflectedTask } from '@replays/domain/value-objects/reflected-task.vo';
import type { ReflectionResult } from '@replays/domain/value-objects/reflection-result';
import type { SearchStopReason } from '@replays/domain/value-objects/search-stop-reason';
import { RunId } from '@shared-kernel/domain/value-objects/run-id.vo';
import { TaskId } from '@shared-kernel/domain/value-objects/task-id.vo';
import { WorkspaceId } from '@shared-kernel/domain/value-objects/workspace-id.vo';
import { describe, expect, it } from 'vitest';

const taskAt = (at: number) =>
  ReflectedTask.of({
    taskId: TaskId.of(`task_${at}`),
    originalRunId: RunId.of(`original_${at}`),
    replayRunId: RunId.of(`replayed_${at}`),
  });

const causeOf = (at: number, kind: FailureCauseKind) =>
  FailureCause.of({
    task: taskAt(at),
    cause: kind,
    evidence: `Evidence ${at}.`,
    suggestion: null,
    at: new Date('2026-10-01T09:00:00.000Z'),
  });

const reflection = (
  result: ReflectionResult,
  endedSearch: boolean,
  causes: readonly FailureCause[],
) => ({
  reflects: true,
  result,
  endedSearch,
  reflectedOn: causes.map((_, at) => taskAt(at)),
  causes,
});

const proposing = { reflects: false };

const searchOf = (
  stopReason: SearchStopReason | null,
  iterations: readonly object[],
): Search =>
  ({
    stopReason,
    iterations,
    workspaceId: WorkspaceId.of('ws_1'),
  }) as unknown as Search;

const findings = () => new SearchFindings(new FakeWork());

describe('SearchFindings', () => {
  it('says a search stalled with no budget left to look into why', async () => {
    const stalled = searchOf('stalled', [proposing, proposing]);

    expect(await findings().findingsOf(stalled)).toEqual([
      'Two iterations in a row found nothing better. No budget was left to find out why.',
    ]);
    expect(await findings().stallFixesOf(stalled)).toEqual([]);
    expect(await findings().findingsOf(searchOf(null, [proposing]))).toEqual(
      [],
    );
  });

  it('reads the newest reflection that found something, over an older one', async () => {
    const search = searchOf('stalled', [
      reflection('continued', false, [causeOf(1, 'judge')]),
      proposing,
      reflection('no-config-cause', true, [causeOf(2, 'check')]),
    ]);

    const found = await findings().findingsOf(search);

    expect(found[0]).toMatch(/^No config change can fix/);
    expect(found.join(' ')).toContain('Evidence 2.');
    expect(found.join(' ')).not.toContain('Evidence 1.');
    expect(await findings().stallFixesOf(search)).toEqual([
      'Untitled task: the cause is the check. Evidence 2. Please fix the check of the station.',
    ]);
  });

  it('reports a reflection that kept the search going, and advises nothing until a stall', async () => {
    const going = searchOf(null, [
      reflection('continued', false, [causeOf(1, 'task')]),
      proposing,
    ]);

    expect(await findings().findingsOf(going)).toEqual([
      expect.stringMatching(/^Two iterations in a row found nothing better\./),
      'Untitled task: the cause is the task itself. Evidence 1. Spotlight takes the task out of the replay set.',
    ]);
    expect(await findings().stallFixesOf(going)).toEqual([]);
  });
});
