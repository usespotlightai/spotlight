import type { DefinedIntegrationsPort } from '@integrations/application/ports/defined-integrations.port';
import type { IntegrationRuntimePort } from '@integrations/application/ports/integration-runtime.port';
import type { CallAuthResolver } from '@integrations/application/services/call-auth-resolver.service';
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
    private readonly callAuthResolver: CallAuthResolver,
    private readonly learning: LearnOutputShapes,
    private readonly personRules: PersonToolRules,
  ) {}

  async resolve(
    tool: string,
    task: BoundTaskDto,
    run: RunAttemptDto,
    requester: string | null,
  ): Promise<IntegrationTool | null> {
    const teamId = TeamId.of(task.teamId);
    const definitions = await this.defined.ofTeam(teamId);
    const resolved = await this.runtime.tool(
      definitions,
      tool,
      BoundTaskMapper.toBound(task),
    );

    if (!resolved) {
      return null;
    }

    const found = await this.callAuthResolver.connectionFor(
      teamId,
      resolved.integration,
      requester ? UserId.of(requester) : null,
    );

    if (found.kind === 'wanted') {
      return {
        declared: resolved.declared,
        actingAs: null,
        personRule: null,
        wants: {
          source: found.wanted.source.value,
          integration: found.wanted.integrationName,
          personId: found.wanted.personId?.value ?? null,
          because: found.wanted.because,
        },
        defaultFor: (input) => resolved.defaultFor(input),
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
      resolved.integration.source,
      found.holder,
      tool,
    );

    return {
      declared: resolved.declared,
      personRule: personRule
        ? {
            rule: personRule.rule.name,
            personId: personRule.personId.value,
            personName: personRule.personName,
          }
        : null,
      actingAs: resolved.integration.connects
        ? {
            holder: found.holder.isPerson ? 'person' : 'team',
            personId: found.holder.personId?.value ?? null,
            handle: found.connection?.handle ?? null,
          }
        : null,
      wants: null,
      defaultFor: (input) => resolved.defaultFor(input),
      call: async (inputs) => {
        const answer = await resolved.call(
          inputs,
          await this.callAuthResolver.forRun(
            {
              teamId,
              workspaceId: task.workspaceId,
              runId: run.runId,
              attempt: run.attempt,
              injectedSecrets: resolved.injectedSecrets,
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
