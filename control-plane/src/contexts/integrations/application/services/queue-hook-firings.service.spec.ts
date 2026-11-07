import type { ListeningHook } from '@integrations/application/ports/hook-runtime.port';
import {
  brokenHook,
  clock,
  EVENT,
  firingsInMemory,
  hookNamed,
  logger,
  NOW,
  runtimeOf,
  TASK,
} from '@integrations/application/services/hook-firings.fake-spec';
import { QueueHookFirings } from '@integrations/application/services/queue-hook-firings.service';
import { HookDefinitionId } from '@integrations/domain/value-objects/hook-definition-id.vo';
import { HookFiringId } from '@integrations/domain/value-objects/hook-firing-id.vo';
import { causationInMemory } from '@shared-kernel/application/ports/causation.fake-spec';
import { telemetryInMemory } from '@shared-kernel/application/ports/telemetry.fake-spec';
import { CausalChain } from '@shared-kernel/domain/value-objects/causal-chain.vo';
import { RunId } from '@shared-kernel/domain/value-objects/run-id.vo';
import { StationKey } from '@shared-kernel/domain/value-objects/station-key.vo';
import { describe, expect, it, vi } from 'vitest';

const setUp = (
  hooks: ListeningHook[],
  whenHolds: () => boolean = () => true,
) => {
  const runtime = runtimeOf(hooks, whenHolds);
  const inMemory = firingsInMemory();
  const causation = causationInMemory();
  const telemetry = telemetryInMemory();
  let ids = 0;

  return {
    runtime,
    causation,
    telemetry,
    firings: inMemory.firings,
    queueing: new QueueHookFirings(
      runtime,
      inMemory.firings,
      { generate: () => `id_${++ids}` },
      clock,
      causation,
      logger(),
      telemetry,
    ),
  };
};

describe('QueueHookFirings', () => {
  it('queues one firing per matching hook, keyed by the occurrence', async () => {
    const { queueing, firings, telemetry } = setUp([
      hookNamed('a', ['x'], { on: 'tool.used' }),
      hookNamed('b', ['y'], { on: 'tool.used' }),
    ]);

    await expect(
      queueing.queue({
        on: 'tool.used',
        occurrence: 'occurrence_1',
        change: 'grafana.search',
        task: TASK,
        event: EVENT,
      }),
    ).resolves.toBe(2);

    const [fired] = vi.mocked(firings.add).mock.calls[0] ?? [];
    expect(fired).toMatchObject({
      id: HookFiringId.of('id_1'),
      hookId: HookDefinitionId.of('a_id'),
      occurrence: 'occurrence_1',
      runId: RunId.of('run_1'),
      stationKey: StationKey.of('implementation'),
      matched: true,
      link: {
        kind: 'hook',
        key: 'hook:a_id:tool.used:task_1:grafana.search',
        description: 'the hook a',
      },
      progress: { kind: 'pending', dueAt: NOW },
    });
    expect(telemetry.counted).toHaveLength(2);
  });

  it('fires in the chain of causes it happened in, followed by what happened', async () => {
    const { queueing, firings, causation } = setUp([
      hookNamed('a', ['x'], { on: 'task.moved' }),
    ]);
    const delivered = CausalChain.none().append({
      kind: 'delivery',
      key: 'delivery:slack',
      description: 'a delivery from slack',
    });

    await causation.runWith(delivered, () =>
      queueing.queue({
        on: 'task.moved',
        occurrence: 'moved_1',
        change: 'triage → build',
        task: TASK,
        event: { from: 'triage', to: 'build' },
      }),
    );

    const [fired] = vi.mocked(firings.add).mock.calls[0] ?? [];
    expect(fired?.cause.description).toBe(
      'a delivery from slack → task.moved of Add a column (triage → build)',
    );
  });

  it('queues nothing for a hook that no longer reads as written, or does not match', async () => {
    const broken = setUp([brokenHook('a', false)]);
    const unmatched = setUp(
      [hookNamed('a', ['x'], { on: 'task.moved' })],
      () => false,
    );
    const happened = {
      on: 'task.moved' as const,
      occurrence: 'moved_1',
      change: 'triage → build',
      task: TASK,
      event: {},
    };

    await expect(broken.queueing.queue(happened)).resolves.toBe(0);
    await expect(unmatched.queueing.queue(happened)).resolves.toBe(0);
    expect(unmatched.firings.add).not.toHaveBeenCalled();
  });

  it('queues a firing matched only later without matching it now', async () => {
    const { queueing, firings, runtime } = setUp(
      [hookNamed('dba', ['tell'], { on: 'pull-request.merged' })],
      () => false,
    );

    await expect(
      queueing.queue({
        on: 'pull-request.merged',
        occurrence: 'merged_1',
        change: 'https://github.com/acme/api/pull/7',
        task: TASK,
        event: { url: 'https://github.com/acme/api/pull/7' },
        matchedLater: true,
      }),
    ).resolves.toBe(1);
    expect(runtime.whenHolds).not.toHaveBeenCalled();
    expect(vi.mocked(firings.add).mock.calls[0]?.[0]?.matched).toBe(false);
  });

  it('counts only a firing it queued, not one queued before', async () => {
    const { queueing, firings, telemetry } = setUp([
      hookNamed('a', ['x'], { on: 'task.moved' }),
    ]);
    vi.mocked(firings.add).mockResolvedValueOnce(false);

    await expect(
      queueing.queue({
        on: 'task.moved',
        occurrence: 'moved_1',
        change: 'triage → build',
        task: TASK,
        event: {},
      }),
    ).resolves.toBe(0);
    expect(telemetry.counted).toEqual([]);
  });
});
