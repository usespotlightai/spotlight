import { CreateHarnessProfileCommand } from '@configuration/application/commands/create-harness-profile.command';
import { CreateHarnessProfileHandler } from '@configuration/application/commands/handlers/create-harness-profile.handler';
import { UpdateHarnessProfileHandler } from '@configuration/application/commands/handlers/update-harness-profile.handler';
import { UpdateHarnessProfileCommand } from '@configuration/application/commands/update-harness-profile.command';
import type { SecretNamesPort } from '@configuration/application/ports/secret-names.port';
import type { SecretUseLocksPort } from '@configuration/application/ports/secret-use-locks.port';
import { HarnessProfile } from '@configuration/domain/aggregates/harness-profile.aggregate';
import type { HarnessProfileRepository } from '@configuration/domain/repositories/harness-profile.repository';
import { HarnessProfileId } from '@configuration/domain/value-objects/harness-profile-id.vo';
import { KnownSecrets } from '@configuration/domain/value-objects/known-secrets.vo';
import { ProfileSettings } from '@configuration/domain/value-objects/profile-settings.vo';
import { HarnessProfileCompiler } from '@configuration/infrastructure/profiles/harness-profile.compile';
import type { TeamDirectoryPort } from '@identity/application/ports/team-directory.port';
import { teamAccess } from '@identity/application/ports/workspace-access.fake-spec';
import type { IdempotentCreatesPort } from '@shared-kernel/application/ports/idempotent-creates.port';
import type { TransactionPort } from '@shared-kernel/application/ports/transaction.port';
import { actorFor } from '@shared-kernel/domain/value-objects/change-actor.fake-spec';
import { ProfileKey } from '@shared-kernel/domain/value-objects/profile-key.vo';
import { SecretName } from '@shared-kernel/domain/value-objects/secret-name.vo';
import { TeamId } from '@shared-kernel/domain/value-objects/team-id.vo';
import { WorkspaceId } from '@shared-kernel/domain/value-objects/workspace-id.vo';
import { describe, expect, it, vi } from 'vitest';

const TEAM = TeamId.of('team_1');

const APP_KEY = SecretName.of('DEV_GITHUB_APP_KEY');

const DEFINITION = {
  key: 'careful',
  permissions: { allow: ['read'] },
  env: { GITHUB_APP_PRIVATE_KEY: 'DEV_GITHUB_APP_KEY' },
};

const NOT_ALLOWED =
  'names secret DEV_GITHUB_APP_KEY, which does not allow its value in a sandbox. Set sandbox = "env" on the secret';

const compiler = new HarnessProfileCompiler({
  review: () => ({ problems: [], warnings: [] }),
});

const teams = {
  find: vi.fn(() =>
    Promise.resolve({
      id: TEAM,
      workspaceId: WorkspaceId.of('ws_1'),
      key: 'core',
      name: 'Core',
      members: [],
    }),
  ),
  inWorkspace: vi.fn(() => Promise.resolve([])),
} satisfies TeamDirectoryPort;

const transaction: TransactionPort = { inTransaction: (work) => work() };

const stored = HarnessProfile.rehydrate({
  id: HarnessProfileId.of('profile_1'),
  teamId: TEAM,
  key: ProfileKey.of('careful'),
  settings: ProfileSettings.fromRaw({
    permissions: { allow: ['read'], ask: [], deny: [] },
    mcpServers: [],
    native: {},
    secrets: [],
    env: {},
  }),
  version: 1,
});

const setUp = (sandboxSecrets: readonly SecretName[]) => {
  const steps: string[] = [];
  const locks: SecretUseLocksPort = {
    lock: vi.fn((teamId: TeamId) => {
      steps.push(`locked ${teamId.value}`);
      return Promise.resolve();
    }),
  };
  const secrets: SecretNamesPort = {
    ofTeam: vi.fn(() => Promise.resolve([APP_KEY])),
    known: vi.fn(() => {
      steps.push('read known secrets');

      return Promise.resolve(
        KnownSecrets.of({ existing: [APP_KEY], sandboxSecrets }),
      );
    }),
  };
  const profiles = {
    withId: vi.fn(() => Promise.resolve(stored)),
    ofTeam: vi.fn(() => Promise.resolve([])),
    save: vi.fn<HarnessProfileRepository['save']>(async () => {}),
  } satisfies HarnessProfileRepository;

  return { steps, locks, secrets, profiles };
};

describe('CreateHarnessProfileHandler', () => {
  const create = (sandboxSecrets: readonly SecretName[]) => {
    const { steps, locks, secrets, profiles } = setUp(sandboxSecrets);
    const handler = new CreateHarnessProfileHandler(
      teamAccess(TEAM),
      teams,
      compiler,
      secrets,
      locks,
      profiles,
      {
        reserve: vi.fn(() => Promise.resolve({ kind: 'new' as const })),
        recordCreated: vi.fn(async () => {}),
      } satisfies IdempotentCreatesPort,
      { generate: () => 'profile_new' },
      transaction,
    );

    return {
      steps,
      created: handler.execute(
        new CreateHarnessProfileCommand(
          TEAM.value,
          actorFor('user_1'),
          'key-1',
          DEFINITION,
        ),
      ),
    };
  };

  it('locks the uses of the team’s secrets before it reads them', async () => {
    const { steps, created } = create([APP_KEY]);

    expect(await created).toEqual({
      outcome: 'created',
      id: 'profile_new',
      replayed: false,
    });
    expect(steps).toEqual(['locked team_1', 'read known secrets']);
  });

  it('refuses a profile that puts in the sandbox a secret that does not allow it', async () => {
    const outcome = await create([]).created;

    expect(outcome?.outcome).toBe('invalid');
    expect(
      outcome?.outcome === 'invalid'
        ? outcome.problems.map((each) => each.reason)
        : [],
    ).toEqual([NOT_ALLOWED]);
  });
});

describe('UpdateHarnessProfileHandler', () => {
  const update = (sandboxSecrets: readonly SecretName[]) => {
    const { steps, locks, secrets, profiles } = setUp(sandboxSecrets);
    const handler = new UpdateHarnessProfileHandler(
      teamAccess(TEAM),
      compiler,
      secrets,
      locks,
      profiles,
      transaction,
    );

    return {
      steps,
      updated: handler.execute(
        new UpdateHarnessProfileCommand(
          'profile_1',
          actorFor('user_1'),
          1,
          DEFINITION,
        ),
      ),
    };
  };

  it('locks the uses of the team’s secrets before it reads them', async () => {
    const { steps, updated } = update([APP_KEY]);

    expect(await updated).toEqual({ outcome: 'updated', id: 'profile_1' });
    expect(steps).toEqual(['locked team_1', 'read known secrets']);
  });

  it('refuses a profile that puts in the sandbox a secret that does not allow it', async () => {
    const outcome = await update([]).updated;

    expect(outcome?.outcome).toBe('invalid');
    expect(
      outcome?.outcome === 'invalid'
        ? outcome.problems.map((each) => each.reason)
        : [],
    ).toEqual([NOT_ALLOWED]);
  });
});
