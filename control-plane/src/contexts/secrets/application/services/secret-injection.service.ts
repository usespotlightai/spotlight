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
import type { RunGrantsRepository } from '@secrets/domain/repositories/run-grants.repository';
import type { SecretRepository } from '@secrets/domain/repositories/secret.repository';
import { RunHold } from '@secrets/domain/value-objects/run-hold.vo';
import type { WornHeader } from '@secrets/domain/value-objects/secret-binding.vo';
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
    const hold = RunHold.of(RunId.of(grant.runId), grant.attempt);
    const granted: SecretGrant[] = [];

    for (const secret of await this.held(grant.workspaceId, grant.secrets)) {
      granted.push(...secret.grantedTo(hold.runId));
    }

    await this.kept.changed(
      { hold, workspaceId: WorkspaceId.of(grant.workspaceId) },
      (held) => held.granted(hold, granted),
    );
  }

  async forRun(request: RunRequest): Promise<WornSecrets> {
    const hold = RunHold.of(RunId.of(request.runId), request.attempt);
    const held = await this.grants.find(hold.runId);

    return this.worn(request, (secret) => {
      const grant = secret.grantToward(hold.runId, request.url);

      if (!held?.allows(hold, grant)) {
        throw new SecretNotGrantedError(secret.name.value, grant.host);
      }
    });
  }

  forSpotlight(request: SpotlightRequest): Promise<WornSecrets> {
    return this.worn(request, () => undefined);
  }

  async forVerifying(request: VerifyingRequest): Promise<VerifyingSecret> {
    const [secret] = await this.held(request.workspaceId, [request.secret]);

    return VerifyingSecret.of((await this.sources.read(secret)).revealed());
  }

  private async worn(
    request: SpotlightRequest,
    allowed: (secret: Secret) => void,
  ): Promise<WornSecrets> {
    const worn: WornHeader[] = [];

    for (const secret of await this.held(
      request.workspaceId,
      request.secrets,
    )) {
      secret.bindingToward(request.url);
      allowed(secret);
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
