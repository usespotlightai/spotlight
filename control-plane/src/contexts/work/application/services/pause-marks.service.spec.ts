import { RunId } from '@shared-kernel/domain/value-objects/run-id.vo';
import { RunnerId } from '@shared-kernel/domain/value-objects/runner-id.vo';
import { WorkspaceId } from '@shared-kernel/domain/value-objects/workspace-id.vo';
import type { RunJournalPort } from '@work/application/ports/run-journal.port';
import { PauseMarks } from '@work/application/services/pause-marks.service';
import { RunPaused } from '@work/domain/events/run-paused.event';
import { RunOutcome } from '@work/domain/value-objects/run-outcome.vo';
import { describe, expect, it, vi } from 'vitest';

const NOW = new Date('2026-10-30T09:00:00.000Z');

const paused = (resumesAtOnce: boolean) =>
  new RunPaused(
    RunId.of('run_1'),
    WorkspaceId.of('ws_1'),
    null,
    RunnerId.of('runner_1'),
    RunOutcome.of({ exitCode: 0, failed: false }),
    null,
    null,
    1,
    NOW,
    resumesAtOnce,
  );

const marked = async (resumesAtOnce: boolean) => {
  const appendControlPlaneEntry = vi.fn().mockResolvedValue(undefined);
  await new PauseMarks({
    appendControlPlaneEntry,
  } as unknown as RunJournalPort).onRunPaused(paused(resumesAtOnce));

  return appendControlPlaneEntry.mock.calls[0]?.[1];
};

describe('PauseMarks', () => {
  it('marks a run that waits for a person', async () => {
    expect(await marked(false)).toEqual({
      type: 'run.paused',
      at: NOW,
      message: 'Waiting for a person',
    });
  });

  it('marks a run that starts again at once to read messages that came in during its turn', async () => {
    expect((await marked(true))?.message).toBe(
      'Messages came in during the turn. The run starts again to read them.',
    );
  });
});
