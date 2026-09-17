import { integrationFilesIn } from '@configuration/application/contracts/configuration-layout.contract';
import type { AppliedConfigurationPort } from '@configuration/application/ports/applied-configuration.port';
import type { IntegrationRuntimePort } from '@integrations/application/ports/integration-runtime.port';
import type { HostReach } from '@integrations/application/services/host-reach.service';
import { TeamId } from '@shared-kernel/domain/value-objects/team-id.vo';
import type { BoundTaskDto } from '@work/application/dto/bound-task.dto';
import type {
  IntegrationTool,
  IntegrationToolCallsPort,
} from '@work/application/ports/integration-tool-calls.port';

export class IntegrationToolCalls implements IntegrationToolCallsPort {
  constructor(
    private readonly configurations: AppliedConfigurationPort,
    private readonly runtime: IntegrationRuntimePort,
    private readonly hosts: HostReach,
  ) {}

  async reach(
    tool: string,
    task: BoundTaskDto,
  ): Promise<IntegrationTool | null> {
    const teamId = TeamId.of(task.teamId);
    const applied = await this.configurations.of(teamId);
    const reachable = applied
      ? this.runtime.tool(integrationFilesIn(applied.files), tool, task)
      : null;

    if (!reachable) {
      return null;
    }

    return {
      declared: reachable.declared,
      defaultFor: (input) => reachable.defaultFor(input),
      call: async (inputs) =>
        reachable.call(
          inputs,
          await this.hosts.of(teamId, reachable.integration),
        ),
    };
  }
}
