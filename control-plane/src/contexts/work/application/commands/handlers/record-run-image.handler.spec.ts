import type { RunnerHeartbeatsPort } from '@runners/application/ports/runner-heartbeats.port';
import { ApplicationError } from '@shared-kernel/application/errors/application-error';
import type { ClockPort } from '@shared-kernel/application/ports/clock.port';
import { HarnessId } from '@shared-kernel/domain/value-objects/harness-id.vo';
import { RunId } from '@shared-kernel/domain/value-objects/run-id.vo';
import { RunnerId } from '@shared-kernel/domain/value-objects/runner-id.vo';
import { RunnerTerms } from '@shared-kernel/domain/value-objects/runner-terms.vo';
import { WorkspaceId } from '@shared-kernel/domain/value-objects/workspace-id.vo';
import { RecordRunImageHandler } from '@work/application/commands/handlers/record-run-image.handler';
import { RecordRunImageCommand } from '@work/application/commands/runner.commands';
import { Run } from '@work/domain/aggregates/run.aggregate';
import type { RunRepository } from '@work/domain/repositories/run.repository';
import { RunSpec } from '@work/domain/value-objects/run-spec.vo';
import { describe, expect, it, vi } from 'vitest';

const NOW = new Date('2026-09-25T09:00:00.000Z');

const PINNED = `ghcr.io/acme/widgets@sha256:${'f'.repeat(64)}`;

const claimed = () =>
  Run.enqueue({
    id: RunId.of('run_1'),
    workspaceId: WorkspaceId.of('ws_1'),
    harness: HarnessId.of('claude-code'),
    spec: RunSpec.of({
      command: { executable: 'claude-agent-acp', args: [] },
      briefing: 'work out what is being asked for',
      handover: { options: [], noteLimit: 4_000 },
      continuity: { key: 'task-task_1' },
    }),
  }).claim(RunnerId.of('runner_1'), NOW);

const recording = (given: { run?: Run | null; known?: boolean } = {}) => {
  const save = vi.fn(async (_: Run) => {});
  const seen = vi.fn(async () =>
    given.known === false
      ? null
      : {
          workspaceId: WorkspaceId.of('ws_1'),
          harnesses: [HarnessId.of('claude-code')],
          terms: RunnerTerms.none(),
          claims: 'reserved' as const,
        },
  );

  const handler = new RecordRunImageHandler(
    {
      findById: vi.fn(async () =>
        given.run === undefined ? claimed() : given.run,
      ),
      save,
    } as unknown as RunRepository,
    { heartbeat: seen } satisfies RunnerHeartbeatsPort,
    { now: () => NOW } as ClockPort,
  );

  return { handler, save, seen };
};

describe('RecordRunImageHandler', () => {
  it('records the image the runner that leases the run started it in', async () => {
    const { handler, save, seen } = recording();

    await handler.execute(
      new RecordRunImageCommand('run_1', 'runner_1', PINNED),
    );

    expect(seen).toHaveBeenCalledWith(RunnerId.of('runner_1'), NOW);
    expect(save.mock.calls[0]?.[0].ranIn?.value).toBe(PINNED);
  });

  it('rejects a runner it does not know, as not found', async () => {
    const { handler, save } = recording({ known: false });

    await expect(
      handler.execute(new RecordRunImageCommand('run_1', 'runner_1', PINNED)),
    ).rejects.toMatchObject({ kind: 'not-found' });
    expect(save).not.toHaveBeenCalled();
  });

  it('rejects a run there is none of, as not found', async () => {
    const { handler, save } = recording({ run: null });

    await expect(
      handler.execute(new RecordRunImageCommand('run_1', 'runner_1', PINNED)),
    ).rejects.toMatchObject({ kind: 'not-found' });
    expect(save).not.toHaveBeenCalled();
  });

  it('rejects a runner that does not lease the run', async () => {
    const { handler, save } = recording();

    await expect(
      handler.execute(new RecordRunImageCommand('run_1', 'runner_2', PINNED)),
    ).rejects.toMatchObject({ kind: 'conflict' });
    expect(save).not.toHaveBeenCalled();
  });

  it('rejects an image that is not named by its digest, or not an image at all', async () => {
    const { handler, save } = recording();

    await expect(
      handler.execute(
        new RecordRunImageCommand(
          'run_1',
          'runner_1',
          'ghcr.io/acme/widgets:1',
        ),
      ),
    ).rejects.toThrow(ApplicationError);
    await expect(
      handler.execute(
        new RecordRunImageCommand('run_1', 'runner_1', 'Not An Image'),
      ),
    ).rejects.toMatchObject({ kind: 'invalid' });
    expect(save).not.toHaveBeenCalled();
  });
});
