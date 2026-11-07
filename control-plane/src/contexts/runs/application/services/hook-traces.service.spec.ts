import type { HookCallTrace } from '@runs/application/ports/hook-traces.port';
import type { RunJournalPort } from '@runs/application/ports/run-journal.port';
import type { RunStreamPort } from '@runs/application/ports/run-stream.port';
import { HookTraces } from '@runs/application/services/hook-traces.service';
import { Run } from '@runs/domain/aggregates/run.aggregate';
import { claimer, orderedFor } from '@runs/domain/aggregates/run.fake-spec';
import type { RunRepository } from '@runs/domain/repositories/run.repository';
import { RunAttempt } from '@runs/domain/value-objects/run-attempt.vo';
import { RunSpec } from '@runs/domain/value-objects/run-spec.vo';
import { HarnessId } from '@shared-kernel/domain/value-objects/harness-id.vo';
import { RunId } from '@shared-kernel/domain/value-objects/run-id.vo';
import { RunnerId } from '@shared-kernel/domain/value-objects/runner-id.vo';
import { WorkspaceId } from '@shared-kernel/domain/value-objects/workspace-id.vo';
import { describe, expect, it, vi } from 'vitest';

const NOW = new Date('2026-09-26T09:00:00.000Z');

const onSecondAttempt = () =>
  Run.enqueue({
    id: RunId.of('run_1'),
    workspaceId: WorkspaceId.of('ws_1'),
    harness: HarnessId.of('dev'),
    ...orderedFor.spec(),
    spec: RunSpec.of({
      command: { executable: 'sh', args: [] },
      briefing: 'do the thing',
      handover: { options: [], noteLimit: 4_000 },
      resume: {},
    }),
  })
    .claim(claimer(RunnerId.of('runner_1')), NOW)
    .expireLease(new Date(NOW.getTime() + 60_000));

const CALL: HookCallTrace = {
  attempt: 2,
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
  const appendControlPlaneEntry = vi.fn(
    async (_: RunAttempt, entry: { type: string; at: Date }) => ({
      seq: seq--,
      type: entry.type,
      at: entry.at,
    }),
  );
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

describe('HookTraces', () => {
  it('journals a hook’s call as a control-plane entry', async () => {
    const { traces, appendControlPlaneEntry } = tracing();

    await traces.record('run_1', CALL);

    expect(appendControlPlaneEntry).toHaveBeenCalledWith(
      RunAttempt.of(RunId.of('run_1'), 2),
      {
        type: 'hook.called',
        call: CALL,
        at: new Date(NOW.getTime() + 120),
      },
    );
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

  it('journals a call into the attempt the hook fired for', async () => {
    const { traces, appendControlPlaneEntry } = tracing();

    await traces.record('run_1', { ...CALL, attempt: 1 });

    expect(appendControlPlaneEntry).toHaveBeenCalledWith(
      RunAttempt.of(RunId.of('run_1'), 1),
      expect.anything(),
    );
  });

  it('journals nothing for an attempt the run has not made', async () => {
    const { traces, appendControlPlaneEntry } = tracing();

    await traces.record('run_1', { ...CALL, attempt: 3 });

    expect(appendControlPlaneEntry).not.toHaveBeenCalled();
  });

  it('journals nothing for a run that is gone', async () => {
    const { traces, appendControlPlaneEntry, publish } = tracing(null);

    await traces.record('run_1', CALL);

    expect(appendControlPlaneEntry).not.toHaveBeenCalled();
    expect(publish).not.toHaveBeenCalled();
  });
});
