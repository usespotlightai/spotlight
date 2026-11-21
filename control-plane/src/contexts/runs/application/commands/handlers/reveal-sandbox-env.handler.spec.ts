import { RevealSandboxEnvHandler } from '@runs/application/commands/handlers/reveal-sandbox-env.handler';
import { RevealSandboxEnvCommand } from '@runs/application/commands/runner.commands';
import { aLeasedRun } from '@runs/application/services/working-copy-archives.fake-spec';
import type { Run } from '@runs/domain/aggregates/run.aggregate';
import type { RunRepository } from '@runs/domain/repositories/run.repository';
import { Credential } from '@secrets/application/contracts/credential.contract';
import type { SandboxEnvRequest } from '@secrets/application/contracts/sandbox-env.contract';
import { RunnerOffer } from '@shared-kernel/domain/value-objects/runner-offer.vo';
import { WorkspaceId } from '@shared-kernel/domain/value-objects/workspace-id.vo';
import { describe, expect, it } from 'vitest';

const KEY = {
  variable: 'GITHUB_APP_PRIVATE_KEY',
  secret: 'DEV_GITHUB_APP_KEY',
};

const setUp = (run: Run = aLeasedRun({ sandboxEnv: [KEY] })) => {
  const asked: SandboxEnvRequest[] = [];
  const stored = new Map<string, Run>([[run.id.value, run]]);
  const runs = {
    findById: async (id: { value: string }) => stored.get(id.value) ?? null,
  } as unknown as RunRepository;

  return {
    asked,
    stored,
    reveal: new RevealSandboxEnvHandler(
      runs,
      {
        claimantOf: async () => ({
          workspaceId: WorkspaceId.of('ws_1'),
          harnesses: [],
          offer: RunnerOffer.none(),
          claims: 'nothing' as const,
        }),
      },
      {
        revealFor: async (request) => {
          asked.push(request);
          return {
            variables: request.variables.map((each) => ({
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
      { workspaceId: 'ws_1', runId: 'run_1', variables: [KEY] },
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
    ).rejects.toMatchObject({ kind: 'conflict' });
    await expect(
      reveal.execute(new RevealSandboxEnvCommand('run_1', 'runner_1', 2)),
    ).rejects.toMatchObject({ kind: 'conflict' });
    expect(asked).toEqual([]);
  });

  it('refuses a run it does not know', async () => {
    const { reveal } = setUp();

    await expect(
      reveal.execute(new RevealSandboxEnvCommand('run_9', 'runner_1', 1)),
    ).rejects.toMatchObject({ kind: 'not-found' });
  });
});
