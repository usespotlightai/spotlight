import type { ClockPort } from '@shared-kernel/application/ports/clock.port';
import { HarnessId } from '@shared-kernel/domain/value-objects/harness-id.vo';
import { RunId } from '@shared-kernel/domain/value-objects/run-id.vo';
import { RunnerId } from '@shared-kernel/domain/value-objects/runner-id.vo';
import { WorkspaceId } from '@shared-kernel/domain/value-objects/workspace-id.vo';
import { ClaimRunHandler } from '@work/application/commands/handlers/claim-run.handler';
import { ClaimRunCommand } from '@work/application/commands/runner.commands';
import type { ClaimedWorkDto } from '@work/application/dto/run.dto';
import type { ClaimedCheck } from '@work/application/ports/check-work.port';
import type { RunLeases } from '@work/application/services/run-leases.service';
import { Run } from '@work/domain/aggregates/run.aggregate';
import type { RunRepository } from '@work/domain/repositories/run.repository';
import { RunSpec } from '@work/domain/value-objects/run-spec.vo';
import { describe, expect, it, vi } from 'vitest';

const NOW = new Date('2026-08-31T09:00:00.000Z');

const spec = RunSpec.of({
  command: { executable: 'claude-agent-acp', args: ['--acp'] },
  briefing: 'work out what is being asked for',
  handover: { options: ['Spec'], noteLimit: 4_000 },
  continuity: { key: 'task_1-station_1', keep: true },
});

const queued = () =>
  Run.enqueue({
    id: RunId.of('run_1'),
    workspaceId: WorkspaceId.of('ws_1'),
    harness: HarnessId.of('claude-code'),
    spec,
  }).claim(RunnerId.of('runner_1'), NOW);

const aCheck: ClaimedCheck = {
  stackId: 'stack_1',
  runId: 'run_1',
  repository: 'widgets',
  base: '0123456789abcdef0123456789abcdef01234567',
  setup: 'npm ci',
  command: 'npm test',
  steps: [
    { id: 'whole', patch: 'diff', stopsOnFailure: true, runsSetup: true },
  ],
};

const claiming = (
  claimNext = vi.fn(async (): Promise<Run | null> => queued()),
  claimCheck = vi.fn(async (): Promise<ClaimedCheck | null> => null),
) =>
  new ClaimRunHandler(
    { claimNext } as unknown as RunRepository,
    { requeueLapsed: vi.fn(async () => []) } as unknown as RunLeases,
    {
      seen: vi.fn(async () => ({
        workspaceId: WorkspaceId.of('ws_1'),
        harnesses: [HarnessId.of('claude-code')],
      })),
    },
    { now: () => NOW, sleep: async () => {} } as ClockPort,
    { claimNext: claimCheck },
  );

const runOf = (claimed: ClaimedWorkDto | null) =>
  claimed?.kind === 'run' ? claimed.run : null;

describe('ClaimRunHandler', () => {
  it('hands the runner the spec itself, not the wrapper around it', async () => {
    const claimed = await claiming().execute(new ClaimRunCommand('runner_1'));

    expect(runOf(claimed)?.spec).toEqual({
      command: { executable: 'claude-agent-acp', args: ['--acp'] },
      briefing: 'work out what is being asked for',
      handover: { options: ['Spec'], noteLimit: 4_000 },
      continuity: { key: 'task_1-station_1', keep: true },
    });
  });

  it('only looks for work in the runner’s own workspace', async () => {
    const claimNext = vi.fn(async () => queued());

    await claiming(claimNext).execute(new ClaimRunCommand('runner_1'));

    expect(claimNext).toHaveBeenCalledWith(
      expect.objectContaining({ workspaceId: WorkspaceId.of('ws_1') }),
      NOW,
    );
  });

  it('survives the round trip a runner actually makes', async () => {
    const claimed = await claiming().execute(new ClaimRunCommand('runner_1'));

    const overTheWire = JSON.parse(JSON.stringify(claimed)) as {
      run: { spec: { command: { executable: string } } };
    };

    expect(overTheWire.run.spec.command.executable).toBe('claude-agent-acp');
  });

  it('offers a check only once no run wants the runner', async () => {
    const claimCheck = vi.fn(async () => aCheck);
    const claimed = await claiming(
      vi.fn(async () => null),
      claimCheck,
    ).execute(new ClaimRunCommand('runner_1'));

    expect(claimed).toEqual({ kind: 'check', check: aCheck });
    expect(claimCheck).toHaveBeenCalledWith(
      WorkspaceId.of('ws_1'),
      RunnerId.of('runner_1'),
      NOW,
    );
  });

  it('leaves a check waiting while a run wants the runner', async () => {
    const claimCheck = vi.fn(async () => aCheck);

    const claimed = await claiming(
      vi.fn(async () => queued()),
      claimCheck,
    ).execute(new ClaimRunCommand('runner_1'));

    expect(claimed?.kind).toBe('run');
    expect(claimCheck).not.toHaveBeenCalled();
  });
});
