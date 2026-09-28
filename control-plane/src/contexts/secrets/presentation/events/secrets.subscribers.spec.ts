import { AbandonWorkspaceSecrets } from '@secrets/application/services/abandon-workspace-secrets.service';
import { ForgetRunGrants } from '@secrets/application/services/forget-run-grants.service';
import { RunGrantsKept } from '@secrets/application/services/run-grants-kept';
import { RunGrants } from '@secrets/domain/aggregates/run-grants.aggregate';
import { Secret } from '@secrets/domain/aggregates/secret.aggregate';
import { RunHold } from '@secrets/domain/value-objects/run-hold.vo';
import { SecretId } from '@secrets/domain/value-objects/secret-id.vo';
import { secretsSubscribers } from '@secrets/presentation/events/secrets.subscribers';
import {
  BY,
  clockAt,
  definition,
  InMemoryGrants,
  InMemorySecrets,
  InMemoryStore,
  NOW,
  RecordingLogger,
  transaction,
  WORKSPACE,
} from '@secrets/secrets.fakes.fake-spec';
import { WORKSPACE_CLOSED } from '@shared-kernel/application/integration-events/workspace-closed.integration-event';
import { RunId } from '@shared-kernel/domain/value-objects/run-id.vo';
import type { WorkspaceId } from '@shared-kernel/domain/value-objects/workspace-id.vo';
import { describe, expect, it } from 'vitest';

const closed = {
  kind: WORKSPACE_CLOSED,
  workspaceId: WORKSPACE.value,
  slug: 'acme',
} as never;

const holding = async () => {
  const store = new InMemoryStore();
  const secrets = new InMemorySecrets(store);
  const grants = new InMemoryGrants();
  const forgotten: WorkspaceId[] = [];

  await secrets.save(
    Secret.set(definition(), {
      id: SecretId.of('secret_linear'),
      workspaceId: WORKSPACE,
      by: BY,
      at: NOW,
    }),
  );

  await grants.save(
    RunGrants.begun(RunHold.of(RunId.of('run_1'), 1), WORKSPACE),
  );

  const subscribers = secretsSubscribers({
    abandoning: new AbandonWorkspaceSecrets(secrets, transaction),
    keys: { forget: async (workspaceId) => void forgotten.push(workspaceId) },
    runGrants: new ForgetRunGrants(
      grants,
      new RunGrantsKept(grants),
      clockAt(),
      new RecordingLogger(),
    ),
  });

  return { secrets, store, grants, forgotten, subscribers };
};

describe('secretsSubscribers', () => {
  it('abandons the secrets a closed workspace still held, and their values', async () => {
    const { secrets, store, subscribers } = await holding();

    await subscribers
      .find(
        (each) => each.name === 'secrets.abandon-secrets-of-closed-workspace',
      )
      ?.handle(closed);

    expect(await secrets.inWorkspace(WORKSPACE)).toEqual([]);
    expect(store.holds(SecretId.of('secret_linear'))).toBe(false);
    expect(secrets.events[secrets.events.length - 1]).toMatchObject({
      kind: 'secret.abandoned',
    });
  });

  it('forgets the data key of a closed workspace', async () => {
    const { forgotten, subscribers } = await holding();

    await subscribers
      .find(
        (each) => each.name === 'secrets.forget-data-key-of-closed-workspace',
      )
      ?.handle(closed);

    expect(forgotten.map((each) => each.value)).toEqual([WORKSPACE.value]);
  });

  it('forgets the secret grants a closed workspace’s runs held', async () => {
    const { grants, subscribers } = await holding();

    await subscribers
      .find(
        (each) => each.name === 'secrets.forget-run-grants-of-closed-workspace',
      )
      ?.handle(closed);

    expect(grants.of('run_1')).toBeNull();
  });
});
