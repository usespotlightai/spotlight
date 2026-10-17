import { VerifyingSecret } from '@secrets/application/contracts/verifying-secret.contract';
import { WornSecrets } from '@secrets/application/contracts/worn-secrets.contract';
import type {
  RunGrant,
  RunRequest,
  SecretInjectionPort,
  SpotlightRequest,
  VerifyingRequest,
} from '@secrets/application/ports/secret-injection.port';
import type { RunGrantsKept } from '@secrets/application/services/run-grants-kept';
import type { SecretSources } from '@secrets/application/services/secret-sources.service';
import type { Secret } from '@secrets/domain/aggregates/secret.aggregate';
import { NoSuchSecretError } from '@secrets/domain/exceptions/no-such-secret.error';
import { SecretNotGrantedError } from '@secrets/domain/exceptions/secret-not-granted.error';
import { SecretSlotTakenError } from '@secrets/domain/exceptions/secret-slot-taken.error';
import type { RunGrantsRepository } from '@secrets/domain/repositories/run-grants.repository';
import type { SecretRepository } from '@secrets/domain/repositories/secret.repository';
import { RunLease } from '@secrets/domain/value-objects/run-lease.vo';
import type { WornSecret } from '@secrets/domain/value-objects/secret-binding.vo';
import type { SecretGrant } from '@secrets/domain/value-objects/secret-grant.vo';
import { RunId } from '@shared-kernel/domain/value-objects/run-id.vo';
import { SecretName } from '@shared-kernel/domain/value-objects/secret-name.vo';
import { WorkspaceId } from '@shared-kernel/domain/value-objects/workspace-id.vo';

export class SecretInjection implements SecretInjectionPort {
  constructor(
    private readonly secrets: SecretRepository,
    private readonly grants: RunGrantsRepository,
    private readonly kept: RunGrantsKept,
    private readonly sources: SecretSources,
  ) {}

  async grant(grant: RunGrant): Promise<void> {
    const lease = RunLease.of(RunId.of(grant.runId), grant.attempt);
    const granted: SecretGrant[] = [];

    for (const secret of await this.named(grant.workspaceId, grant.secrets)) {
      granted.push(...secret.grantTo(lease.runId));
    }

    await this.kept.changed(
      { lease, workspaceId: WorkspaceId.of(grant.workspaceId) },
      (current) => current.grant(lease, granted),
    );
  }

  async forRun(request: RunRequest): Promise<WornSecrets> {
    const lease = RunLease.of(RunId.of(request.runId), request.attempt);
    const existing = await this.grants.find(lease.runId);

    return this.worn(request, (secret) => {
      const grant = secret.grantToward(lease.runId, request.url);

      if (!existing?.allows(lease, grant)) {
        throw new SecretNotGrantedError(secret.name.value, grant.host);
      }
    });
  }

  forSpotlight(request: SpotlightRequest): Promise<WornSecrets> {
    return this.worn(request, () => undefined);
  }

  async forVerifying(request: VerifyingRequest): Promise<VerifyingSecret> {
    const [secret] = await this.named(request.workspaceId, [request.secret]);

    return VerifyingSecret.of((await this.sources.read(secret)).revealed());
  }

  private async worn(
    request: SpotlightRequest,
    allowed: (secret: Secret) => void,
  ): Promise<WornSecrets> {
    const worn: { readonly secret: string; readonly worn: WornSecret }[] = [];

    for (const secret of await this.named(
      request.workspaceId,
      request.secrets,
    )) {
      const binding = secret.bindingToward(request.url);
      const taken = worn.find(
        (each) =>
          each.worn.carrier === binding.carrier.kind &&
          each.worn.name === binding.carrier.name,
      );

      if (taken) {
        throw new SecretSlotTakenError(
          secret.name.value,
          taken.secret,
          binding.carrier.kind === 'query'
            ? `?${binding.carrier.name}`
            : binding.carrier.name,
        );
      }

      allowed(secret);
      worn.push({
        secret: secret.name.value,
        worn: secret.wornToward(request.url, await this.sources.read(secret)),
      });
    }

    return WornSecrets.of(worn.map((each) => each.worn));
  }

  private async named(
    workspaceId: string,
    names: readonly string[],
  ): Promise<readonly Secret[]> {
    const workspace = WorkspaceId.of(workspaceId);
    const found: Secret[] = [];

    for (const name of new Set(names)) {
      const secret = await this.secrets.named(workspace, SecretName.of(name));

      if (!secret) {
        throw new NoSuchSecretError(name);
      }

      found.push(secret);
    }

    return found;
  }
}
