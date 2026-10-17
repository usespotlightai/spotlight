import type { WorkspaceAccessPort } from '@identity/application/ports/workspace-access.port';
import type { UpdateIntegrationCommand } from '@integrations/application/commands/update-integration.command';
import { IntegrationProblems } from '@integrations/application/rendering/integration-problems';
import type { IntegrationSources } from '@integrations/application/services/integration-sources.service';
import type { ToolsGiven } from '@integrations/application/services/tools-given.service';
import type { IntegrationDefinition } from '@integrations/domain/aggregates/integration-definition.aggregate';
import { IntegrationDefinitionVersionConflictError } from '@integrations/domain/exceptions/integration-definition-version-conflict.error';
import { IntegrationToolsInUseError } from '@integrations/domain/exceptions/integration-tools-in-use.error';
import type { IntegrationDefinitionRepository } from '@integrations/domain/repositories/integration-definition.repository';
import { IntegrationDefinitionId } from '@integrations/domain/value-objects/integration-definition-id.vo';
import {
  forbiddenTo,
  type ResourceUpdated,
} from '@shared-kernel/application/dto/resource-outcomes.dto';
import { rethrowAsApplicationError } from '@shared-kernel/application/errors/rethrow-as-application-error';
import type { CommandHandlerPort } from '@shared-kernel/application/ports/command-handler.port';
import type { TransactionPort } from '@shared-kernel/application/ports/transaction.port';
import { ImmutableFieldError } from '@shared-kernel/domain/exceptions/immutable-field.error';
import { Attribution } from '@shared-kernel/domain/value-objects/attribution.vo';

export class UpdateIntegrationHandler
  implements
    CommandHandlerPort<UpdateIntegrationCommand, ResourceUpdated | null>
{
  constructor(
    private readonly access: WorkspaceAccessPort,
    private readonly sources: IntegrationSources,
    private readonly definitions: IntegrationDefinitionRepository,
    private readonly given: ToolsGiven,
    private readonly transaction: TransactionPort,
  ) {}

  async execute(
    command: UpdateIntegrationCommand,
  ): Promise<ResourceUpdated | null> {
    const id = IntegrationDefinitionId.of(command.integrationId);

    let loaded: IntegrationDefinition | null = null;

    try {
      const existing = await this.definitions.withId(id);
      loaded = existing;
      const permissions = existing
        ? await this.access.permissionsOnTeam(
            existing.teamId.value,
            command.actor.principal,
          )
        : null;

      if (!existing || !permissions) {
        return null;
      }

      if (!permissions.configures) {
        return forbiddenTo('configure');
      }

      existing.assertVersion(command.expectedVersion);

      const { compiled, reading } = await this.sources.compiled({
        definition: command.definition,
        teamId: existing.teamId,
        current: existing.reading,
      });

      if (!compiled.ok) {
        return { outcome: 'invalid', problems: compiled.problems };
      }

      const given = await this.given.onTeam(existing.teamId);

      await this.transaction.inTransaction(() =>
        this.definitions.save(
          existing.update(
            compiled,
            reading,
            given,
            Attribution.of(command.actor, permissions.workspaceId),
          ),
        ),
      );

      return { outcome: 'updated', id: id.value };
    } catch (error) {
      if (error instanceof IntegrationDefinitionVersionConflictError) {
        const current = await this.definitions.withId(id);

        return current
          ? { outcome: 'version-conflict', currentVersion: current.version }
          : null;
      }

      if (error instanceof ImmutableFieldError) {
        return {
          outcome: 'invalid',
          problems: [
            IntegrationProblems.immutableField(
              loaded?.source.value ?? '',
              error,
            ),
          ],
        };
      }

      if (error instanceof IntegrationToolsInUseError) {
        return { outcome: 'in-use', reason: error.message };
      }

      rethrowAsApplicationError(error);
    }
  }
}
