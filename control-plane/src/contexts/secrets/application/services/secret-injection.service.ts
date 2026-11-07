import { InjectedSecrets } from '@secrets/application/contracts/injected-secrets.contract';
import { VerifyingSecret } from '@secrets/application/contracts/verifying-secret.contract';
import type {
  RunGrant,
  RunRequest,
  SecretInjectionPort,
  SpotlightRequest,
  VerifyingRequest,
} from '@secrets/application/ports/secret-injection.port';
import type { RunGrantsChanges } from '@secrets/application/services/run-grants-changes';
import type { SecretSources } from '@secrets/application/services/secret-sources.service';
import type { Secret } from '@secrets/domain/aggregates/secret.aggregate';
import { NoSuchSecretError } from '@secrets/domain/exceptions/no-such-secret.error';
import { SecretNotGrantedError } from '@secrets/domain/exceptions/secret-not-granted.error';
import type { RunGrantsRepository } from '@secrets/domain/repositories/run-grants.repository';
import type { SecretRepository } from '@secrets/domain/repositories/secret.repository';
import { RunLease } from '@secrets/domain/value-objects/run-lease.vo';
import type { InjectedSecret } from '@secrets/domain/value-objects/secret-binding.vo';
import type { SecretGrant } from '@secrets/domain/value-objects/secret-grant.vo';
import { SecretTargets } from '@secrets/domain/value-objects/secret-targets.vo';
import { RunId } from '@shared-kernel/domain/value-objects/run-id.vo';
import { SecretName } from '@shared-kernel/domain/value-objects/secret-name.vo';
import { WorkspaceId } from '@shared-kernel/domain/value-objects/workspace-id.vo';

type Injecting = (secret: Secret) => Promise<InjectedSecret>;

const standInFor =
  (url: string): Injecting =>
  async (secret) =>
    secret.standInFor(url);

export class SecretInjection implements SecretInjectionPort {
  constructor(
    private readonly secrets: SecretRepository,
    private readonly grants: RunGrantsRepository,
    private readonly changes: RunGrantsChanges,
    private readonly sources: SecretSources,
  ) {}

  async grant(grant: RunGrant): Promise<void> {
    const lease = RunLease.of(RunId.of(grant.runId), grant.attempt);
    const granted: SecretGrant[] = [];

    for (const secret of await this.named(grant.workspaceId, grant.secrets)) {
      granted.push(...secret.grantTo(lease.runId));
    }

    await this.changes.changed(
      { lease, workspaceId: WorkspaceId.of(grant.workspaceId) },
      (current) => current.grant(lease, granted),
    );
  }

  async forRun(request: RunRequest): Promise<InjectedSecrets> {
    return this.injected(
      request,
      await this.grantedTo(request),
      this.valueFor(request.url),
    );
  }

  forSpotlight(request: SpotlightRequest): Promise<InjectedSecrets> {
    return this.injected(request, () => undefined, this.valueFor(request.url));
  }

  standInsFor(request: SpotlightRequest): Promise<InjectedSecrets> {
    return this.injected(request, () => undefined, standInFor(request.url));
  }

  async standInsForRun(request: RunRequest): Promise<InjectedSecrets> {
    return this.injected(
      request,
      await this.grantedTo(request),
      standInFor(request.url),
    );
  }

  async forVerifying(request: VerifyingRequest): Promise<VerifyingSecret> {
    const [secret] = await this.named(request.workspaceId, [request.secret]);

    return VerifyingSecret.of((await this.sources.read(secret)).revealed());
  }

  private async grantedTo(
    request: RunRequest,
  ): Promise<(secret: Secret) => void> {
    const lease = RunLease.of(RunId.of(request.runId), request.attempt);
    const existing = await this.grants.find(lease.runId);

    return (secret) => {
      const grant = secret.grantForUrl(lease.runId, request.url);

      if (!existing?.allows(lease, grant)) {
        throw new SecretNotGrantedError(secret.name.value, grant.host.value);
      }
    };
  }

  private valueFor(url: string): Injecting {
    return async (secret) =>
      secret.injectedFor(url, await this.sources.read(secret));
  }

  private async injected(
    request: SpotlightRequest,
    allowed: (secret: Secret) => void,
    injecting: Injecting,
  ): Promise<InjectedSecrets> {
    const injected: InjectedSecret[] = [];
    let targets = SecretTargets.none();

    for (const secret of await this.named(
      request.workspaceId,
      request.secrets,
    )) {
      targets = targets.claim(secret.name, [secret.bindingForUrl(request.url)]);
      allowed(secret);
      injected.push(await injecting(secret));
    }

    return InjectedSecrets.from(injected);
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
