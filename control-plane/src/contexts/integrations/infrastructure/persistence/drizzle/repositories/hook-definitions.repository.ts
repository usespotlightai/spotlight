import type { HookSigningSecretsPort } from '@integrations/application/ports/hook-signing-secrets.port';
import { HookDefinition } from '@integrations/domain/aggregates/hook-definition.aggregate';
import { HookAlreadyDefinedError } from '@integrations/domain/exceptions/hook-already-defined.error';
import { HookDefinitionMovedOnError } from '@integrations/domain/exceptions/hook-definition-moved-on.error';
import type { HookDefinitionRepository } from '@integrations/domain/repositories/hook-definition.repository';
import { DefinitionDocument } from '@integrations/domain/value-objects/definition-document.vo';
import { HookDefinitionId } from '@integrations/domain/value-objects/hook-definition-id.vo';
import { HookEvent } from '@integrations/domain/value-objects/hook-event.vo';
import { HookKey } from '@integrations/domain/value-objects/hook-key.vo';
import { HookSigningSecret } from '@integrations/domain/value-objects/hook-signing-secret.vo';
import { ToolName } from '@integrations/domain/value-objects/tool-name.vo';
import { hookDefinition } from '@integrations/infrastructure/persistence/drizzle/schemas/hook.schema';
import { Inject, Injectable } from '@nestjs/common';
import { DrizzleContext } from '@platform/persistence/drizzle/drizzle.context';
import { Credential } from '@secrets/application/contracts/credential.contract';
import {
  CREDENTIAL_SEALING,
  type CredentialSealingPort,
} from '@secrets/application/ports/credential-sealing.port';
import {
  DOMAIN_EVENT_DISPATCHER,
  type DomainEventDispatcher,
} from '@shared-kernel/application/ports/domain-event-dispatcher.port';
import { TeamId } from '@shared-kernel/domain/value-objects/team-id.vo';
import { WorkspaceId } from '@shared-kernel/domain/value-objects/workspace-id.vo';
import { and, asc, eq, type SQL } from 'drizzle-orm';

const UNIQUE_VIOLATION = '23505';

const collided = (error: unknown): boolean =>
  (
    ((error as { cause?: unknown } | null)?.cause ?? error) as {
      code?: string;
    } | null
  )?.code === UNIQUE_VIOLATION;

const secretLabel = (hookId: string): string => `hook:${hookId}:signing-secret`;

const inPlace = (definition: HookDefinition) =>
  and(
    eq(hookDefinition.id, definition.id.value),
    eq(hookDefinition.version, definition.version),
  );

type Row = typeof hookDefinition.$inferSelect;

const rehydrated = (row: Row): HookDefinition =>
  HookDefinition.rehydrate({
    id: HookDefinitionId.of(row.id),
    workspaceId: WorkspaceId.of(row.workspaceId),
    teamId: TeamId.of(row.teamId),
    key: HookKey.of(row.key),
    event: HookEvent.of(row.on),
    document: DefinitionDocument.of(row.definition),
    tools: row.tools.map((tool) => ToolName.of(tool)),
    signing:
      row.signingSecretVersion === null
        ? null
        : { version: row.signingSecretVersion },
    version: row.version,
  });

@Injectable()
export class DrizzleHookDefinitions
  implements HookDefinitionRepository, HookSigningSecretsPort
{
  constructor(
    private readonly context: DrizzleContext,
    @Inject(DOMAIN_EVENT_DISPATCHER)
    private readonly events: DomainEventDispatcher,
    @Inject(CREDENTIAL_SEALING)
    private readonly sealing: CredentialSealingPort,
  ) {}

  async withId(id: HookDefinitionId): Promise<HookDefinition | null> {
    const found = await this.first(eq(hookDefinition.id, id.value));

    return found ? rehydrated(found) : null;
  }

  async of(teamId: TeamId, key: HookKey): Promise<HookDefinition | null> {
    const found = await this.first(
      and(
        eq(hookDefinition.teamId, teamId.value),
        eq(hookDefinition.key, key.value),
      ),
    );

    return found ? rehydrated(found) : null;
  }

  async ofTeam(teamId: TeamId): Promise<readonly HookDefinition[]> {
    return (
      await this.context.db
        .select()
        .from(hookDefinition)
        .where(eq(hookDefinition.teamId, teamId.value))
        .orderBy(asc(hookDefinition.key))
    ).map(rehydrated);
  }

  async save(definition: HookDefinition): Promise<void> {
    await this.context.run(async () => {
      await this.stored(definition);
      await this.events.dispatch(definition.pullEvents());
    });
  }

  async signingSecretOf(hookId: string): Promise<HookSigningSecret | null> {
    const found = await this.first(eq(hookDefinition.id, hookId));

    if (!found?.signingSecret) {
      return null;
    }

    return HookSigningSecret.of(
      (
        await this.sealing.open(
          found.workspaceId,
          secretLabel(found.id),
          found.signingSecret,
        )
      ).revealed(),
    );
  }

  private async sealed(definition: HookDefinition) {
    const given = definition.givenSecret;

    if (definition.signing === null) {
      return { signingSecret: null, signingSecretVersion: null };
    }

    return given
      ? {
          signingSecret: await this.sealing.seal(
            definition.workspaceId.value,
            secretLabel(definition.id.value),
            Credential.of(given.revealed()),
          ),
          signingSecretVersion: definition.signing.version,
        }
      : { signingSecretVersion: definition.signing.version };
  }

  private async stored(definition: HookDefinition): Promise<void> {
    const written = {
      on: definition.event.name,
      definition: { ...definition.document.fields },
      tools: definition.tools.map((tool) => tool.value),
      ...(await this.sealed(definition)),
    };

    if (definition.isNew) {
      try {
        await this.context.db.insert(hookDefinition).values({
          id: definition.id.value,
          workspaceId: definition.workspaceId.value,
          teamId: definition.teamId.value,
          key: definition.key.value,
          ...written,
        });
      } catch (error) {
        if (collided(error)) {
          throw new HookAlreadyDefinedError(definition.key.value);
        }

        throw error;
      }

      return;
    }

    const touched = definition.isRetired
      ? await this.context.db
          .delete(hookDefinition)
          .where(inPlace(definition))
          .returning({ id: hookDefinition.id })
      : await this.context.db
          .update(hookDefinition)
          .set({ ...written, version: definition.version + 1 })
          .where(inPlace(definition))
          .returning({ id: hookDefinition.id });

    if (touched.length === 0) {
      throw new HookDefinitionMovedOnError(definition.key.value);
    }
  }

  private async first(where: SQL | undefined): Promise<Row | null> {
    const [found] = await this.context.db
      .select()
      .from(hookDefinition)
      .where(where)
      .limit(1);

    return found ?? null;
  }
}
