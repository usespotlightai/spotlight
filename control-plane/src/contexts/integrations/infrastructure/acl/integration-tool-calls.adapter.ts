import type { DefinedIntegrationsPort } from '@integrations/application/ports/defined-integrations.port';
import type { IntegrationRuntimePort } from '@integrations/application/ports/integration-runtime.port';
import type { HostReach } from '@integrations/application/services/host-reach.service';
import { BoundTaskMapper } from '@integrations/infrastructure/acl/bound-task.mapper';
import { TeamId } from '@shared-kernel/domain/value-objects/team-id.vo';
import type { BoundTaskDto } from '@work/application/dto/bound-task.dto';
import type {
  IntegrationTool,
  IntegrationToolCallsPort,
} from '@work/application/ports/integration-tool-calls.port';

export class IntegrationToolCalls implements IntegrationToolCallsPort {
  constructor(
    private readonly defined: DefinedIntegrationsPort,
    private readonly runtime: IntegrationRuntimePort,
    private readonly hosts: HostReach,
  ) {}

  async reach(
    tool: string,
    task: BoundTaskDto,
    runId: string,
  ): Promise<IntegrationTool | null> {
    const teamId = TeamId.of(task.teamId);
    const definitions = await this.defined.ofTeam(teamId);
    const reachable = this.runtime.tool(
      definitions,
      tool,
      BoundTaskMapper.toBound(task),
    );

    if (!reachable) {
      return null;
    }

    return {
      declared: reachable.declared,
      defaultFor: (input) => reachable.defaultFor(input),
      call: async (inputs) =>
        reachable.call(
          inputs,
          await this.hosts.forRun(
            {
              teamId,
              workspaceId: task.workspaceId,
              runId,
              wears: reachable.wears,
            },
            reachable.integration,
          ),
        ),
    };
  }
}
