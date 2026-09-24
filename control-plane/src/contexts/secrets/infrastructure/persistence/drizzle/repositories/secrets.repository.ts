import { DrizzleContext } from '@platform/persistence/drizzle/drizzle.context';
import { Secret } from '@secrets/domain/aggregates/secret.aggregate';
import { SecretAbandoned } from '@secrets/domain/events/secret-abandoned.event';
import { SecretDeleted } from '@secrets/domain/events/secret-deleted.event';
import { SecretRedefined } from '@secrets/domain/events/secret-redefined.event';
import { SecretRotated } from '@secrets/domain/events/secret-rotated.event';
import { SecretSet } from '@secrets/domain/events/secret-set.event';
import { SecretAlreadyDefinedError } from '@secrets/domain/exceptions/secret-already-defined.error';
import { SecretMovedOnError } from '@secrets/domain/exceptions/secret-moved-on.error';
import type { SecretRepository } from '@secrets/domain/repositories/secret.repository';
import { SecretBindings } from '@secrets/domain/value-objects/secret-bindings.vo';
import { SecretId } from '@secrets/domain/value-objects/secret-id.vo';
import { SecretSource } from '@secrets/domain/value-objects/secret-source.vo';
import {
  secret,
  secretAudit,
} from '@secrets/infrastructure/persistence/drizzle/schemas/secret.schema';
import type { BuiltInSecretStore } from '@secrets/infrastructure/sources/built-in-secret.store';
import type { DomainEventDispatcher } from '@shared-kernel/application/ports/domain-event-dispatcher.port';
import type { DomainEvent } from '@shared-kernel/domain/events/domain-event';
import { SecretName } from '@shared-kernel/domain/value-objects/secret-name.vo';
import { WorkspaceId } from '@shared-kernel/domain/value-objects/workspace-id.vo';
import { and, eq, type SQL } from 'drizzle-orm';

const UNIQUE_VIOLATION = '23505';

const collided = (error: unknown): boolean =>
  (
    ((error as { cause?: unknown } | null)?.cause ?? error) as {
      code?: string;
    } | null
  )?.code === UNIQUE_VIOLATION;

type Row = typeof secret.$inferSelect;

const sourceOf = (row: Row): SecretSource =>
  row.source === 'aws-secrets-manager'
    ? SecretSource.awsSecretsManager({
        secretId: row.sourceSecretId ?? '',
        field: row.sourceField,
      })
    : SecretSource.builtIn();

const rehydrated = (row: Row): Secret =>
  Secret.rehydrate({
    id: SecretId.of(row.id),
    workspaceId: WorkspaceId.of(row.workspaceId),
    name: SecretName.of(row.name),
    source: sourceOf(row),
    bindings: SecretBindings.of(row.bindings),
    valueVersion: row.valueVersion,
    rotatedAt: row.rotatedAt,
    version: row.version,
  });

const inPlace = (held: Secret) =>
  and(eq(secret.id, held.id.value), eq(secret.version, held.version));

const audited = (event: DomainEvent) => {
  if (event instanceof SecretSet) {
    return {
      workspaceId: event.workspaceId.value,
      secretId: event.secretId.value,
      secretName: event.secretName.value,
      change: 'set',
      by: event.by.value,
      valueVersion: event.valueVersion,
    };
  }

  if (event instanceof SecretRedefined) {
    return {
      workspaceId: event.workspaceId.value,
      secretId: event.secretId.value,
      secretName: event.secretName.value,
      change: 'redefined',
      by: event.by.value,
      hosts: [...event.hosts],
    };
  }

  if (event instanceof SecretRotated) {
    return {
      workspaceId: event.workspaceId.value,
      secretId: event.secretId.value,
      secretName: event.secretName.value,
      change: 'rotated',
      by: event.by.value,
      valueVersion: event.valueVersion,
    };
  }

  if (event instanceof SecretDeleted) {
    return {
      workspaceId: event.workspaceId.value,
      secretId: event.secretId.value,
      secretName: event.secretName.value,
      change: 'deleted',
      by: event.by.value,
    };
  }

  if (event instanceof SecretAbandoned) {
    return {
      workspaceId: event.workspaceId.value,
      secretId: event.secretId.value,
      secretName: event.secretName.value,
      change: 'abandoned',
      by: null,
    };
  }

  return null;
};

export class DrizzleSecrets implements SecretRepository {
  constructor(
    private readonly context: DrizzleContext,
    private readonly events: DomainEventDispatcher,
    private readonly values: BuiltInSecretStore,
  ) {}

  withId(id: SecretId): Promise<Secret | null> {
    return this.first(eq(secret.id, id.value));
  }

  named(workspaceId: WorkspaceId, name: SecretName): Promise<Secret | null> {
    return this.first(
      and(
        eq(secret.workspaceId, workspaceId.value),
        eq(secret.name, name.value),
      ),
    );
  }

  async inWorkspace(workspaceId: WorkspaceId): Promise<readonly Secret[]> {
    return (
      await this.context.db
        .select()
        .from(secret)
        .where(eq(secret.workspaceId, workspaceId.value))
    ).map(rehydrated);
  }

  async save(held: Secret): Promise<void> {
    await this.context.run(async () => {
      await this.stored(held);
      await this.settled(held);

      const events = held.pullEvents();
      const entries = events.map(audited).filter((each) => each !== null);

      if (entries.length > 0) {
        await this.context.db.insert(secretAudit).values(entries);
      }

      await this.events.dispatch(events);
    });
  }

  private async stored(held: Secret): Promise<void> {
    const fields = {
      source: held.source.kind,
      sourceSecretId: held.source.secretId,
      sourceField: held.source.field,
      bindings: held.bindings.all.map((each) => ({
        host: each.host,
        header: each.header,
        prefix: each.prefix,
      })),
      valueVersion: held.valueVersion,
      rotatedAt: held.rotatedAt,
    };

    if (held.isNew) {
      try {
        await this.context.db.insert(secret).values({
          id: held.id.value,
          workspaceId: held.workspaceId.value,
          name: held.name.value,
          ...fields,
        });
      } catch (error) {
        if (collided(error)) {
          throw new SecretAlreadyDefinedError(held.name.value);
        }

        throw error;
      }

      return;
    }

    const touched = held.isDeleted
      ? await this.context.db
          .delete(secret)
          .where(inPlace(held))
          .returning({ id: secret.id })
      : await this.context.db
          .update(secret)
          .set({ ...fields, version: held.version + 1 })
          .where(inPlace(held))
          .returning({ id: secret.id });

    if (touched.length === 0) {
      throw new SecretMovedOnError(held.name.value);
    }
  }

  private async settled(held: Secret): Promise<void> {
    if (held.keeping) {
      await this.values.keep(held, held.keeping);
    } else if (held.forgetsValue) {
      await this.values.forget(held);
    }
  }

  private async first(where: SQL | undefined): Promise<Secret | null> {
    const [found] = await this.context.db
      .select()
      .from(secret)
      .where(where)
      .limit(1);

    return found ? rehydrated(found) : null;
  }
}
