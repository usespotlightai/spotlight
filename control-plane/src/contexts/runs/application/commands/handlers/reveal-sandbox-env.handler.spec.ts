import { RevealSandboxEnvHandler } from '@runs/application/commands/handlers/reveal-sandbox-env.handler';
import { RevealSandboxEnvCommand } from '@runs/application/commands/runner.commands';
import { aLeasedRun } from '@runs/application/services/working-copy-archives.fake-spec';
import type { Run } from '@runs/domain/aggregates/run.aggregate';
import type { RunRepository } from '@runs/domain/repositories/run.repository';
import { Credential } from '@secrets/application/contracts/credential.contract';
import type { SandboxEnvReveal } from '@secrets/application/contracts/sandbox-env.contract';
import { partial } from '@shared-kernel/domain/partial.fake-spec';
import { RunnerOffer } from '@shared-kernel/domain/value-objects/runner-offer.vo';
import { WorkspaceId } from '@shared-kernel/domain/value-objects/workspace-id.vo';
import { describe, expect, it } from 'vitest';

const KEY = {
  variable: 'GITHUB_APP_PRIVATE_KEY',
  secret: 'DEV_GITHUB_APP_KEY',
};

const setUp = (
  run: Run = aLeasedRun({ sandboxEnv: [KEY] }),
  over: {
    claimant?: boolean;
    duringReveal?: (stored: Map<string, Run>) => void;
  } = {},
) => {
  const asked: SandboxEnvReveal[] = [];
  const stored = new Map<string, Run>([[run.id.value, run]]);
  const runs = partial<RunRepository>({
    findById: async (id: { value: string }) => stored.get(id.value) ?? null,
  });

  return {
    asked,
    stored,
    reveal: new RevealSandboxEnvHandler(
      runs,
      {
        registeredClaimantOf: async () => null,
        claimantOf: async () =>
          over.claimant === false
            ? null
            : {
                workspaceId: WorkspaceId.of('ws_1'),
                harnesses: [],
                offer: RunnerOffer.none(),
                claims: 'nothing' as const,
                source: null,
              },
      },
      {
        reveal: async (request) => {
          asked.push(request);
          over.duringReveal?.(stored);
          return {
            variables: request.sandboxEnv.map((each) => ({
              name: each.variable,
              value: Credential.of('key-value'),
            })),
            denied: [],
          };
        },
      },
      { now: () => new Date(), sleep: async () => {} },
    ),
  };
};

describe('RevealSandboxEnvHandler', () => {
  it('gives the runner that holds the attempt the values its spec names', async () => {
    const { reveal, asked } = setUp();

    const revealed = await reveal.execute(
      new RevealSandboxEnvCommand('run_1', 'runner_1', 1),
    );

    expect(asked).toEqual([
      { workspaceId: 'ws_1', runId: 'run_1', sandboxEnv: [KEY] },
    ]);
    expect(
      revealed.variables.map((each) => [each.name, each.value.revealed()]),
    ).toEqual([['GITHUB_APP_PRIVATE_KEY', 'key-value']]);
  });

  it('asks for no value when the spec puts no secret in the sandbox', async () => {
    const { reveal, asked } = setUp(aLeasedRun());

    await expect(
      reveal.execute(new RevealSandboxEnvCommand('run_1', 'runner_1', 1)),
    ).resolves.toEqual({ variables: [], denied: [] });
    expect(asked).toEqual([]);
  });

  it('refuses another runner, or an attempt the run is no longer on', async () => {
    const { reveal, asked } = setUp();

    await expect(
      reveal.execute(new RevealSandboxEnvCommand('run_1', 'runner_2', 1)),
    ).rejects.toMatchObject({
      kind: 'conflict',
      message:
        'Run run_1 is no longer on attempt 1 for this runner, so nothing more is done for that attempt',
    });
    await expect(
      reveal.execute(new RevealSandboxEnvCommand('run_1', 'runner_1', 2)),
    ).rejects.toMatchObject({
      kind: 'conflict',
      message:
        'Run run_1 is no longer on attempt 2 for this runner, so nothing more is done for that attempt',
    });
    expect(asked).toEqual([]);
  });

  it('refuses a runner it does not know, and asks for no value', async () => {
    const { reveal, asked } = setUp(undefined, { claimant: false });

    await expect(
      reveal.execute(new RevealSandboxEnvCommand('run_1', 'runner_1', 1)),
    ).rejects.toMatchObject({
      kind: 'not-found',
      message: 'Runner runner_1 not found.',
    });
    expect(asked).toEqual([]);
  });

  it('gives no value where the run moves to another runner while the values are read', async () => {
    const { reveal } = setUp(undefined, {
      duringReveal: (stored) =>
        stored.set(
          'run_1',
          aLeasedRun({ runner: 'runner_2', sandboxEnv: [KEY] }),
        ),
    });

    await expect(
      reveal.execute(new RevealSandboxEnvCommand('run_1', 'runner_1', 1)),
    ).rejects.toMatchObject({
      kind: 'conflict',
      message:
        'Run run_1 is no longer on attempt 1 for this runner, so nothing more is done for that attempt',
    });
  });

  it('gives no value where the run is gone once the values are read', async () => {
    const { reveal } = setUp(undefined, {
      duringReveal: (stored) => stored.delete('run_1'),
    });

    await expect(
      reveal.execute(new RevealSandboxEnvCommand('run_1', 'runner_1', 1)),
    ).rejects.toMatchObject({
      kind: 'not-found',
      message: 'Run run_1 not found.',
    });
  });

  it('refuses a run it does not know', async () => {
    const { reveal } = setUp();

    await expect(
      reveal.execute(new RevealSandboxEnvCommand('run_9', 'runner_1', 1)),
    ).rejects.toMatchObject({
      kind: 'not-found',
      message: 'Run run_9 not found.',
    });
  });
});
