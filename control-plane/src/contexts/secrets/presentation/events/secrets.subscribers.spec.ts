import { DeleteWorkspaceSecrets } from '@secrets/application/services/delete-workspace-secrets.service';
import { PurgeRunGrants } from '@secrets/application/services/purge-run-grants.service';
import { RunGrantsUnitOfWork } from '@secrets/application/services/run-grants-unit-of-work';
import { RunGrants } from '@secrets/domain/aggregates/run-grants.aggregate';
import { Secret } from '@secrets/domain/aggregates/secret.aggregate';
import { RunLease } from '@secrets/domain/value-objects/run-lease.vo';
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
import { WORKSPACE_DELETED } from '@shared-kernel/application/integration-events/workspace-deleted.integration-event';
import { RunId } from '@shared-kernel/domain/value-objects/run-id.vo';
import type { WorkspaceId } from '@shared-kernel/domain/value-objects/workspace-id.vo';
import { describe, expect, it } from 'vitest';

const deletedWorkspace = {
  kind: WORKSPACE_DELETED,
  workspaceId: WORKSPACE.value,
  slug: 'acme',
} as never;

const setUp = async () => {
  const store = new InMemoryStore();
  const secrets = new InMemorySecrets(store);
  const grants = new InMemoryGrants();
  const deletedKeys: WorkspaceId[] = [];

  await secrets.save(
    Secret.create(definition(), {
      id: SecretId.of('secret_linear'),
      workspaceId: WORKSPACE,
      by: BY,
      at: NOW,
    }),
  );

  await grants.save(
    RunGrants.start(RunLease.of(RunId.of('run_1'), 1), WORKSPACE),
  );

  const subscribers = secretsSubscribers({
    deleting: new DeleteWorkspaceSecrets(secrets, transaction),
    keys: {
      deleteDataKey: async (workspaceId) => void deletedKeys.push(workspaceId),
    },
    runGrants: new PurgeRunGrants(
      grants,
      new RunGrantsUnitOfWork(grants),
      clockAt(),
      new RecordingLogger(),
    ),
  });

  return { secrets, store, grants, deletedKeys, subscribers };
};

describe('secretsSubscribers', () => {
  it('deletes the secrets a deleted workspace still had, and their values', async () => {
    const { secrets, store, subscribers } = await setUp();

    await subscribers
      .find(
        (each) => each.name === 'secrets.delete-secrets-of-deleted-workspace',
      )
      ?.handle(deletedWorkspace);

    expect(await secrets.inWorkspace(WORKSPACE)).toEqual([]);
    expect(store.has(SecretId.of('secret_linear'))).toBe(false);
    expect(secrets.events[secrets.events.length - 1]).toMatchObject({
      kind: 'secret.deleted',
    });
  });

  it('deletes the data key of a deleted workspace', async () => {
    const { deletedKeys, subscribers } = await setUp();

    await subscribers
      .find(
        (each) => each.name === 'secrets.delete-data-key-of-deleted-workspace',
      )
      ?.handle(deletedWorkspace);

    expect(deletedKeys.map((each) => each.value)).toEqual([WORKSPACE.value]);
  });

  it('deletes the secret grants that the runs of a deleted workspace had', async () => {
    const { grants, subscribers } = await setUp();

    await subscribers
      .find(
        (each) =>
          each.name === 'secrets.delete-run-grants-of-deleted-workspace',
      )
      ?.handle(deletedWorkspace);

    expect(grants.of('run_1')).toBeNull();
  });
});
