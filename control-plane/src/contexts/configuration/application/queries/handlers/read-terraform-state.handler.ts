import type { StateRead } from '@configuration/application/dto/terraform-state-outcomes.dto';
import type { TerraformStateBodiesPort } from '@configuration/application/ports/terraform-state-bodies.port';
import type { ReadTerraformStateQuery } from '@configuration/application/queries/read-terraform-state.query';
import type { TerraformStateRepository } from '@configuration/domain/repositories/terraform-state.repository';
import { StateName } from '@configuration/domain/value-objects/state-name.vo';
import type { WorkspaceAccessPort } from '@identity/application/ports/workspace-access.port';
import { forbiddenTo } from '@shared-kernel/application/dto/resource-outcomes.dto';
import { rethrowAsApplicationError } from '@shared-kernel/application/errors/rethrow-as-application-error';
import type { QueryHandlerPort } from '@shared-kernel/application/ports/query-handler.port';
import { InconsistentStateError } from '@shared-kernel/domain/exceptions/inconsistent-state.error';

export class ReadTerraformStateHandler
  implements QueryHandlerPort<ReadTerraformStateQuery, StateRead>
{
  constructor(
    private readonly access: WorkspaceAccessPort,
    private readonly states: TerraformStateRepository,
    private readonly bodies: TerraformStateBodiesPort,
  ) {}

  async execute(query: ReadTerraformStateQuery): Promise<StateRead> {
    try {
      const permissions = await this.access.permissionsInSlug(
        query.slug,
        query.principal,
      );

      if (!permissions) {
        return null;
      }

      if (!permissions.plans) {
        return forbiddenTo('plan');
      }

      const state = await this.states.named(
        permissions.workspaceId,
        StateName.of(query.name),
      );
      const latest = state?.latest;

      if (!state || !latest) {
        return { outcome: 'empty' };
      }

      const body = await this.bodies.read(state, latest);

      if (!body) {
        throw new InconsistentStateError(
          'Terraform state',
          `has no stored body for version ${latest.number}`,
        );
      }

      return { outcome: 'found', body };
    } catch (error) {
      rethrowAsApplicationError(error);
    }
  }
}
