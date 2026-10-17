import type { DefinedIntegrationsPort } from '@integrations/application/ports/defined-integrations.port';
import type { IntegrationRuntimePort } from '@integrations/application/ports/integration-runtime.port';
import type { CallAuthResolver } from '@integrations/application/services/call-auth-resolver.service';
import type { InferOutputSchemas } from '@integrations/application/services/infer-output-schemas.service';
import type { PersonToolRules } from '@integrations/application/services/person-tool-rules.service';
import { IntegrationTaskViewMapper } from '@integrations/infrastructure/acl/integration-task-view.mapper';
import { InconsistentStateError } from '@shared-kernel/domain/exceptions/inconsistent-state.error';
import { TeamId } from '@shared-kernel/domain/value-objects/team-id.vo';
import { UserId } from '@shared-kernel/domain/value-objects/user-id.vo';
import type { IntegrationTaskViewDto } from '@work/application/dto/integration-task-view.dto';
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
    private readonly inferring: InferOutputSchemas,
    private readonly personRules: PersonToolRules,
  ) {}

  async resolve(
    tool: string,
    task: IntegrationTaskViewDto,
    run: RunAttemptDto,
    requester: string | null,
  ): Promise<IntegrationTool | null> {
    const teamId = TeamId.of(task.teamId);
    const definitions = await this.defined.ofTeam(teamId);
    const resolved = await this.runtime.tool(
      definitions,
      tool,
      IntegrationTaskViewMapper.toView(task),
    );

    if (!resolved) {
      return null;
    }

    const found = await this.callAuthResolver.connectionFor(
      teamId,
      resolved.integration,
      requester ? UserId.of(requester) : null,
    );

    if (found.kind === 'missing') {
      return {
        declared: resolved.declared,
        actingAs: null,
        personRule: null,
        missing: {
          integration: found.missing.integration.value,
          integrationName: found.missing.integrationName,
          personId: found.missing.personId?.value ?? null,
          because: found.missing.because,
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
      resolved.integration.key,
      found.owner,
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
      actingAs: resolved.integration.requiresConnection
        ? {
            actsAs: found.owner.isPerson ? 'requester' : 'team',
            personId: found.owner.personId?.value ?? null,
            linkedAccount: found.connection?.linkedAccount ?? null,
          }
        : null,
      missing: null,
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
        void this.inferring.infer(teamId, tool, answer);

        return answer;
      },
    };
  }
}
