import type { DefinedIntegrationsPort } from '@integrations/application/ports/defined-integrations.port';
import type { IntegrationRuntimePort } from '@integrations/application/ports/integration-runtime.port';
import type { HostReach } from '@integrations/application/services/host-reach.service';
import type { LearnOutputShapes } from '@integrations/application/services/learn-output-shapes.service';
import type { PersonToolRules } from '@integrations/application/services/person-tool-rules.service';
import { BoundTaskMapper } from '@integrations/infrastructure/acl/bound-task.mapper';
import { InconsistentStateError } from '@shared-kernel/domain/exceptions/inconsistent-state.error';
import { TeamId } from '@shared-kernel/domain/value-objects/team-id.vo';
import { UserId } from '@shared-kernel/domain/value-objects/user-id.vo';
import type { BoundTaskDto } from '@work/application/dto/bound-task.dto';
import type {
  IntegrationTool,
  IntegrationToolCallsPort,
  RunAttemptDto,
} from '@work/application/ports/integration-tool-calls.port';

export class IntegrationToolCalls implements IntegrationToolCallsPort {
  constructor(
    private readonly defined: DefinedIntegrationsPort,
    private readonly runtime: IntegrationRuntimePort,
    private readonly hosts: HostReach,
    private readonly learning: LearnOutputShapes,
    private readonly personRules: PersonToolRules,
  ) {}

  async reach(
    tool: string,
    task: BoundTaskDto,
    run: RunAttemptDto,
    requester: string | null,
  ): Promise<IntegrationTool | null> {
    const teamId = TeamId.of(task.teamId);
    const definitions = await this.defined.ofTeam(teamId);
    const reachable = await this.runtime.tool(
      definitions,
      tool,
      BoundTaskMapper.toBound(task),
    );

    if (!reachable) {
      return null;
    }

    const found = await this.hosts.connectionFor(
      teamId,
      reachable.integration,
      requester ? UserId.of(requester) : null,
    );

    if (found.kind === 'wanted') {
      return {
        declared: reachable.declared,
        actingAs: null,
        personRule: null,
        wants: {
          source: found.wanted.source.value,
          integration: found.wanted.integrationName,
          personId: found.wanted.personId?.value ?? null,
          because: found.wanted.because,
        },
        defaultFor: (input) => reachable.defaultFor(input),
        call: async () => {
          throw new InconsistentStateError(
            'integration tool',
            `${tool} was called without the connection it acts with`,
          );
        },
      };
    }

    const personRule = await this.personRules.ruleFor(
      teamId,
      reachable.integration.source,
      found.holder,
      tool,
    );

    return {
      declared: reachable.declared,
      personRule: personRule
        ? {
            rule: personRule.rule.name,
            personId: personRule.personId.value,
            personName: personRule.personName,
          }
        : null,
      actingAs: reachable.integration.connects
        ? {
            holder: found.holder.isPerson ? 'person' : 'team',
            personId: found.holder.personId?.value ?? null,
            handle: found.connection?.handle ?? null,
          }
        : null,
      wants: null,
      defaultFor: (input) => reachable.defaultFor(input),
      call: async (inputs) => {
        const answer = await reachable.call(
          inputs,
          await this.hosts.forRun(
            {
              teamId,
              workspaceId: task.workspaceId,
              runId: run.runId,
              attempt: run.attempt,
              wears: reachable.wears,
            },
            found.connection,
          ),
        );
        void this.learning.learn(teamId, tool, answer);

        return answer;
      },
    };
  }
}
