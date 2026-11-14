import type {
  WorkspaceSecretsPort,
  WorkspaceSecretStore,
} from '@secrets/application/ports/workspace-secrets.port';
import type { SecretSources } from '@secrets/application/services/secret-sources.service';
import { Secret } from '@secrets/domain/aggregates/secret.aggregate';
import type { SecretRepository } from '@secrets/domain/repositories/secret.repository';
import { SecretBindings } from '@secrets/domain/value-objects/secret-bindings.vo';
import { SecretId } from '@secrets/domain/value-objects/secret-id.vo';
import { SecretSource } from '@secrets/domain/value-objects/secret-source.vo';
import { SecretUses } from '@secrets/domain/value-objects/secret-uses.vo';
import { SecretValue } from '@secrets/domain/value-objects/secret-value.vo';
import { ValueVersion } from '@secrets/domain/value-objects/value-version.vo';
import type { ClockPort } from '@shared-kernel/application/ports/clock.port';
import type { IdGeneratorPort } from '@shared-kernel/application/ports/id-generator.port';
import { ChangeActor } from '@shared-kernel/domain/value-objects/change-actor.vo';
import { SecretName } from '@shared-kernel/domain/value-objects/secret-name.vo';
import { WorkspaceId } from '@shared-kernel/domain/value-objects/workspace-id.vo';

export class WorkspaceSecrets implements WorkspaceSecretsPort {
  constructor(
    private readonly secrets: SecretRepository,
    private readonly sources: SecretSources,
    private readonly ids: IdGeneratorPort,
    private readonly clock: ClockPort,
  ) {}

  async store(request: WorkspaceSecretStore): Promise<void> {
    const workspaceId = WorkspaceId.of(request.workspaceId);
    const name = SecretName.of(request.name);
    const existing = await this.secrets.named(workspaceId, name);
    const by = ChangeActor.spotlight(workspaceId);
    const at = this.clock.now();
    const value = request.value === null ? null : SecretValue.of(request.value);
    const definition = {
      name,
      source: SecretSource.builtIn(),
      bindings: SecretBindings.none(),
      value,
    };

    if (!existing) {
      await this.secrets.save(
        Secret.create(
          { ...definition, valueVersion: ValueVersion.of(1) },
          { id: SecretId.of(this.ids.generate()), workspaceId, by, at },
        ),
      );

      return;
    }

    const valueVersion = value
      ? ValueVersion.of((existing.valueVersion?.value ?? 0) + 1)
      : existing.valueVersion;
    const updated = existing.update({ ...definition, valueVersion }, by, at);

    if (updated !== existing) {
      await this.secrets.save(updated);
    }
  }

  async reveal(workspaceId: string, name: string): Promise<string | null> {
    const existing = await this.secrets.named(
      WorkspaceId.of(workspaceId),
      SecretName.of(name),
    );

    return existing ? (await this.sources.read(existing)).revealed() : null;
  }

  async remove(workspaceId: string, name: string): Promise<void> {
    const workspace = WorkspaceId.of(workspaceId);
    const existing = await this.secrets.named(workspace, SecretName.of(name));

    if (existing) {
      await this.secrets.save(
        existing.delete(SecretUses.none(), ChangeActor.spotlight(workspace)),
      );
    }
  }
}
