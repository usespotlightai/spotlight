import type { WorkspaceAccessPort } from '@identity/application/ports/workspace-access.port';
import type { UpdateHookCommand } from '@integrations/application/commands/update-hook.command';
import type { HookCompilerPort } from '@integrations/application/ports/hook-compiler.port';
import { HookProblems } from '@integrations/application/rendering/hook-problems';
import type { HookAllowancesService } from '@integrations/application/services/hook-allowances.service';
import { secretGiven } from '@integrations/application/services/signing-secrets';
import { HookDefinitionMovedOnError } from '@integrations/domain/exceptions/hook-definition-moved-on.error';
import { HookKeyFixedError } from '@integrations/domain/exceptions/hook-key-fixed.error';
import { InvalidHookError } from '@integrations/domain/exceptions/invalid-hook.error';
import type { HookDefinitionRepository } from '@integrations/domain/repositories/hook-definition.repository';
import { HookDefinitionId } from '@integrations/domain/value-objects/hook-definition-id.vo';
import {
  forbiddenTo,
  type ResourceUpdated,
} from '@shared-kernel/application/dto/resource-outcomes.dto';
import { rethrowAsFault } from '@shared-kernel/application/errors/rethrow-as-fault';
import type { CommandHandlerPort } from '@shared-kernel/application/ports/command-handler.port';
import type { TransactionPort } from '@shared-kernel/application/ports/transaction.port';
import { Attribution } from '@shared-kernel/domain/value-objects/attribution.vo';

export class UpdateHookHandler
  implements CommandHandlerPort<UpdateHookCommand, ResourceUpdated | null>
{
  constructor(
    private readonly access: WorkspaceAccessPort,
    private readonly compiler: HookCompilerPort,
    private readonly allowances: HookAllowancesService,
    private readonly definitions: HookDefinitionRepository,
    private readonly transaction: TransactionPort,
  ) {}

  async execute(command: UpdateHookCommand): Promise<ResourceUpdated | null> {
    const id = HookDefinitionId.of(command.hookId);

    try {
      const standing = await this.definitions.withId(id);
      const cleared = standing
        ? await this.access.clearanceOnTeam(
            standing.teamId.value,
            command.actor.principal,
          )
        : null;

      if (!standing || !cleared) {
        return null;
      }

      if (!cleared.configures) {
        return forbiddenTo('configure');
      }

      standing.expecting(command.expectedVersion);

      const compiled = this.compiler.compile(command.definition);

      if (!compiled.ok) {
        return { outcome: 'invalid', problems: compiled.problems };
      }

      await this.transaction.run(async () =>
        this.definitions.save(
          standing.redefinedAs(
            compiled,
            secretGiven(compiled.secret),
            await this.allowances.onTeam(standing.teamId),
            Attribution.of(command.actor, cleared.workspaceId),
          ),
        ),
      );

      return { outcome: 'updated', id: id.value };
    } catch (error) {
      if (error instanceof HookDefinitionMovedOnError) {
        const current = await this.definitions.withId(id);

        return current
          ? { outcome: 'moved-on', currentVersion: current.version }
          : null;
      }

      if (error instanceof HookKeyFixedError) {
        const current = await this.definitions.withId(id);

        return {
          outcome: 'invalid',
          problems: [HookProblems.keyFixed(current?.key.value ?? '', error)],
        };
      }

      if (error instanceof InvalidHookError) {
        const current = await this.definitions.withId(id);

        return {
          outcome: 'invalid',
          problems: [HookProblems.invalid(current?.key.value ?? '', error)],
        };
      }

      rethrowAsFault(error);
    }
  }
}
