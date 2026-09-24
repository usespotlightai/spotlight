import { WornSecrets } from '@secrets/application/contracts/worn-secrets.contract';
import type {
  RunGrant,
  RunRequest,
  SecretInjectionPort,
  SpotlightRequest,
} from '@secrets/application/ports/secret-injection.port';
import type { SecretSources } from '@secrets/application/services/secret-sources.service';
import type { Secret } from '@secrets/domain/aggregates/secret.aggregate';
import { NoSuchSecretError } from '@secrets/domain/exceptions/no-such-secret.error';
import { SecretNotGrantedError } from '@secrets/domain/exceptions/secret-not-granted.error';
import type { SecretRepository } from '@secrets/domain/repositories/secret.repository';
import type { SecretGrantRepository } from '@secrets/domain/repositories/secret-grant.repository';
import type { WornHeader } from '@secrets/domain/value-objects/secret-binding.vo';
import { SecretGrant } from '@secrets/domain/value-objects/secret-grant.vo';
import { RunId } from '@shared-kernel/domain/value-objects/run-id.vo';
import { SecretName } from '@shared-kernel/domain/value-objects/secret-name.vo';
import { WorkspaceId } from '@shared-kernel/domain/value-objects/workspace-id.vo';

export class SecretInjection implements SecretInjectionPort {
  constructor(
    private readonly secrets: SecretRepository,
    private readonly grants: SecretGrantRepository,
    private readonly sources: SecretSources,
  ) {}

  async grant(grant: RunGrant): Promise<void> {
    const runId = RunId.of(grant.runId);
    const granted: SecretGrant[] = [];

    for (const secret of await this.held(grant.workspaceId, grant.secrets)) {
      granted.push(...secret.grantedTo(runId));
    }

    await this.grants.grant(granted);
  }

  async forRun(request: RunRequest): Promise<WornSecrets> {
    const runId = RunId.of(request.runId);

    return this.worn(request, async (secret) => {
      const grant = secret.grantToward(runId, request.url);

      if (!(await this.grants.holds(grant))) {
        throw new SecretNotGrantedError(secret.name.value, grant.host);
      }
    });
  }

  forSpotlight(request: SpotlightRequest): Promise<WornSecrets> {
    return this.worn(request, async () => undefined);
  }

  private async worn(
    request: SpotlightRequest,
    allowed: (secret: Secret) => Promise<void>,
  ): Promise<WornSecrets> {
    const worn: WornHeader[] = [];

    for (const secret of await this.held(
      request.workspaceId,
      request.secrets,
    )) {
      secret.bindingToward(request.url);
      await allowed(secret);
      worn.push(
        secret.wornToward(request.url, await this.sources.read(secret)),
      );
    }

    return WornSecrets.of(worn);
  }

  private async held(
    workspaceId: string,
    names: readonly string[],
  ): Promise<readonly Secret[]> {
    const workspace = WorkspaceId.of(workspaceId);
    const held: Secret[] = [];

    for (const name of new Set(names)) {
      const secret = await this.secrets.named(workspace, SecretName.of(name));

      if (!secret) {
        throw new NoSuchSecretError(name);
      }

      held.push(secret);
    }

    return held;
  }
}
