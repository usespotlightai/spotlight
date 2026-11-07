import type { RunJournalPort } from '@runs/application/ports/run-journal.port';
import { PauseMarks } from '@runs/application/services/pause-marks.service';
import { RunPaused } from '@runs/domain/events/run-paused.event';
import { RunAttempt } from '@runs/domain/value-objects/run-attempt.vo';
import { RunId } from '@shared-kernel/domain/value-objects/run-id.vo';
import { WorkspaceId } from '@shared-kernel/domain/value-objects/workspace-id.vo';
import { describe, expect, it, vi } from 'vitest';

const NOW = new Date('2026-10-30T09:00:00.000Z');

const paused = (resumesAtOnce: boolean) =>
  new RunPaused(
    RunId.of('run_1'),
    WorkspaceId.of('ws_1'),
    RunAttempt.of(RunId.of('run_1'), 1),
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

const facts = (data: string | undefined) =>
  JSON.parse(Buffer.from(data ?? '', 'base64').toString('utf8'));

describe('PauseMarks', () => {
  it('marks a run that waits for a person', async () => {
    const entry = await marked(false);

    expect(entry).toMatchObject({ type: 'run.paused', at: NOW });
    expect(entry?.message).toBeUndefined();
    expect(facts(entry?.data)).toEqual({ resumesAtOnce: false });
  });

  it('marks a run that starts again at once to read messages that came in during its turn', async () => {
    expect(facts((await marked(true))?.data)).toEqual({ resumesAtOnce: true });
  });
});
