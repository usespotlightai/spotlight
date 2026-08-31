import { ClaimRunHandler } from '@application/commands/handlers/runner.handlers';
import { ClaimRunCommand } from '@application/commands/runner.commands';
import type { ClockPort } from '@application/ports/clock.port';
import type { HandoverPort } from '@application/ports/handover.port';
import { Run } from '@domain/aggregates/run.aggregate';
import { Runner } from '@domain/aggregates/runner.aggregate';
import type { RunRepository } from '@domain/repositories/run.repository';
import type { RunnerRepository } from '@domain/repositories/runner.repository';
import { HarnessId } from '@domain/value-objects/harness-id.vo';
import { RunId } from '@domain/value-objects/run-id.vo';
import { RunSpec } from '@domain/value-objects/run-spec.vo';
import { RunnerId } from '@domain/value-objects/runner-id.vo';
import { RunnerName } from '@domain/value-objects/runner-name.vo';
import { TokenHash } from '@domain/value-objects/token-hash.vo';
import { WorkspaceId } from '@domain/value-objects/workspace-id.vo';
import { describe, expect, it, vi } from 'vitest';

const NOW = new Date('2026-08-31T09:00:00.000Z');

const spec = RunSpec.of({
  command: { executable: 'claude-agent-acp', args: ['--acp'] },
  briefing: 'work out what is being asked for',
  handover: { options: ['Spec'] },
  continuity: { key: 'task_1-station_1', keep: true },
});

const queued = () =>
  Run.enqueue({
    id: RunId.of('run_1'),
    workspaceId: WorkspaceId.of('ws_1'),
    harness: HarnessId.of('claude-code'),
    spec,
  }).claim(RunnerId.of('runner_1'), NOW);

const claiming = () =>
  new ClaimRunHandler(
    {
      claimNext: vi.fn(async () => queued()),
      requeueLapsed: vi.fn(async () => []),
    } as unknown as RunRepository,
    {
      find: vi.fn(async () =>
        Runner.rehydrate({
          id: RunnerId.of('runner_1'),
          name: RunnerName.of('one'),
          tokenHash: TokenHash.of('a'.repeat(64)),
          harnesses: [HarnessId.of('claude-code')],
          revokedAt: null,
          lastSeenAt: NOW,
        }),
      ),
      save: vi.fn(async () => undefined),
    } as unknown as RunnerRepository,
    { now: () => NOW } as ClockPort,
    {
      onRunCompleted: vi.fn(),
      onRunAbandoned: vi.fn(),
    } as unknown as HandoverPort,
  );

describe('ClaimRunHandler', () => {
  // The runner reads the spec straight off the wire. Handing it the value
  // object instead of what it holds leaves the runner with no command to run.
  it('hands the runner the spec itself, not the wrapper around it', async () => {
    const claimed = await claiming().execute(new ClaimRunCommand('runner_1'));

    expect(claimed?.spec).toEqual({
      command: { executable: 'claude-agent-acp', args: ['--acp'] },
      briefing: 'work out what is being asked for',
      handover: { options: ['Spec'] },
      continuity: { key: 'task_1-station_1', keep: true },
    });
  });

  it('survives the round trip a runner actually makes', async () => {
    const claimed = await claiming().execute(new ClaimRunCommand('runner_1'));

    const overTheWire = JSON.parse(JSON.stringify(claimed)) as {
      spec: { command: { executable: string } };
    };

    expect(overTheWire.spec.command.executable).toBe('claude-agent-acp');
  });
});
