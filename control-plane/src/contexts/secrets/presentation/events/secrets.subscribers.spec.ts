import { AbandonWorkspaceSecrets } from '@secrets/application/services/abandon-workspace-secrets.service';
import { Secret } from '@secrets/domain/aggregates/secret.aggregate';
import { SecretId } from '@secrets/domain/value-objects/secret-id.vo';
import { secretsSubscribers } from '@secrets/presentation/events/secrets.subscribers';
import {
  BY,
  definition,
  InMemorySecrets,
  InMemoryStore,
  NOW,
  transaction,
  WORKSPACE,
} from '@secrets/secrets.fakes.fake-spec';
import { WORKSPACE_CLOSED } from '@shared-kernel/application/integration-events/workspace-closed.integration-event';
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
  const forgotten: WorkspaceId[] = [];

  await secrets.save(
    Secret.set(definition(), {
      id: SecretId.of('secret_linear'),
      workspaceId: WORKSPACE,
      by: BY,
      at: NOW,
    }),
  );

  const subscribers = secretsSubscribers({
    abandoning: new AbandonWorkspaceSecrets(secrets, transaction),
    keys: { forget: async (workspaceId) => void forgotten.push(workspaceId) },
  });

  return { secrets, store, forgotten, subscribers };
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
});
