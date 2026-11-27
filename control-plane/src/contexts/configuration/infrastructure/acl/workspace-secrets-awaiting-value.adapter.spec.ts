import { WorkspaceSecretsAwaitingValue } from '@configuration/infrastructure/acl/workspace-secrets-awaiting-value.adapter';
import type { SecretReadinessPort } from '@secrets/application/ports/secret-readiness.port';
import { SecretName } from '@shared-kernel/domain/value-objects/secret-name.vo';
import { WorkspaceId } from '@shared-kernel/domain/value-objects/workspace-id.vo';
import { describe, expect, it, vi } from 'vitest';

describe('WorkspaceSecretsAwaitingValue', () => {
  it('names the secrets among those given that await a value, in one lookup', async () => {
    const awaitingValue = vi.fn(
      (_workspace: string, names: readonly string[]) =>
        Promise.resolve(names.filter((each) => each === 'GRAFANA_TOKEN')),
    );
    const awaiting = new WorkspaceSecretsAwaitingValue({
      awaitingValue,
    } satisfies SecretReadinessPort);

    expect(
      (
        await awaiting.awaitingValueIn(WorkspaceId.of('ws_1'), [
          SecretName.of('GRAFANA_TOKEN'),
          SecretName.of('LINEAR_API_KEY'),
        ])
      ).map((each) => each.value),
    ).toEqual(['GRAFANA_TOKEN']);
    expect(awaitingValue).toHaveBeenCalledTimes(1);
    expect(awaitingValue).toHaveBeenCalledWith('ws_1', [
      'GRAFANA_TOKEN',
      'LINEAR_API_KEY',
    ]);
  });
});
