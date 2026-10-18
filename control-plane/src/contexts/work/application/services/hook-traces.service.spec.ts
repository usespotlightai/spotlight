import { HarnessId } from '@shared-kernel/domain/value-objects/harness-id.vo';
import { RunId } from '@shared-kernel/domain/value-objects/run-id.vo';
import { RunnerId } from '@shared-kernel/domain/value-objects/runner-id.vo';
import { WorkspaceId } from '@shared-kernel/domain/value-objects/workspace-id.vo';
import type { HookCallTrace } from '@work/application/ports/hook-traces.port';
import type { RunJournalPort } from '@work/application/ports/run-journal.port';
import type { RunStreamPort } from '@work/application/ports/run-stream.port';
import { HookTraces } from '@work/application/services/hook-traces.service';
import { Run } from '@work/domain/aggregates/run.aggregate';
import type { RunRepository } from '@work/domain/repositories/run.repository';
import { RunAttempt } from '@work/domain/value-objects/run-attempt.vo';
import { RunSpec } from '@work/domain/value-objects/run-spec.vo';
import { describe, expect, it, vi } from 'vitest';

const NOW = new Date('2026-09-26T09:00:00.000Z');

const onSecondAttempt = () =>
  Run.enqueue({
    id: RunId.of('run_1'),
    workspaceId: WorkspaceId.of('ws_1'),
    harness: HarnessId.of('dev'),
    spec: RunSpec.of({
      command: { executable: 'sh', args: [] },
      briefing: 'do the thing',
      handover: { options: [], noteLimit: 4_000 },
      resume: { key: 'task:station' },
    }),
  })
    .claim(RunnerId.of('runner_1'), NOW)
    .expireLease(new Date(NOW.getTime() + 60_000));

const CALL: HookCallTrace = {
  hook: 'core/grafana-reads',
  step: 'notify',
  kind: 'call',
  target: 'slack.post-message',
  request: { channel: 'C1' },
  response: { ok: true },
  status: null,
  failed: false,
  startedAt: NOW,
  ms: 120,
};

const tracing = (run: Run | null = onSecondAttempt()) => {
  let seq = -1_000_000;
  const appendControlPlaneEntry = vi.fn(async () => seq--);
  const publish = vi.fn();

  return {
    appendControlPlaneEntry,
    publish,
    traces: new HookTraces(
      { findById: async () => run } as unknown as RunRepository,
      { appendControlPlaneEntry } as unknown as RunJournalPort,
      { publish } as unknown as RunStreamPort,
    ),
  };
};

const decoded = (data: string | undefined) =>
  JSON.parse(Buffer.from(data ?? '', 'base64').toString('utf8'));

describe('HookTraces', () => {
  it('journals a hook’s call as a control-plane entry on the run’s current attempt', async () => {
    const { traces, appendControlPlaneEntry } = tracing();

    await traces.record('run_1', CALL);

    expect(appendControlPlaneEntry).toHaveBeenCalledWith(
      RunAttempt.of(RunId.of('run_1'), 2),
      expect.objectContaining({
        type: 'hook.called',
        message: 'Hook core/grafana-reads · notify → slack.post-message',
        at: new Date(NOW.getTime() + 120),
      }),
    );
    const [[, entry]] = appendControlPlaneEntry.mock.calls as unknown as [
      [RunAttempt, { data: string }],
    ];
    expect(decoded(entry.data)).toEqual({
      ...CALL,
      startedAt: NOW.toISOString(),
    });
  });

  it('streams the call at the place the journal put it', async () => {
    const { traces, publish } = tracing();

    await traces.record('run_1', CALL);
    await traces.record('run_1', CALL);

    expect(publish).toHaveBeenNthCalledWith(1, 'run_1', [
      expect.objectContaining({
        seq: -1_000_000,
        attempt: 2,
        type: 'hook.called',
        at: new Date(NOW.getTime() + 120).toISOString(),
      }),
    ]);
    expect(publish).toHaveBeenNthCalledWith(2, 'run_1', [
      expect.objectContaining({ seq: -1_000_001 }),
    ]);
  });

  it('journals nothing for a run that is gone', async () => {
    const { traces, appendControlPlaneEntry, publish } = tracing(null);

    await traces.record('run_1', CALL);

    expect(appendControlPlaneEntry).not.toHaveBeenCalled();
    expect(publish).not.toHaveBeenCalled();
  });
});
