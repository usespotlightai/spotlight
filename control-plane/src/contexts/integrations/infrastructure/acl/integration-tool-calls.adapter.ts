import { OUTBOUND_CALL } from '@integrations/application/errors/outbound-limit-reached.error';
import type {
  ResolveToolForRun,
  RunTool,
  RunToolCall,
} from '@integrations/application/services/resolve-tool-for-run.service';
import {
  type CallFailureFact,
  outboundLimitReason,
} from '@integrations/domain/value-objects/hook-failure.vo';
import { RunAttemptRef } from '@integrations/domain/value-objects/run-attempt-ref.vo';
import { ToolName } from '@integrations/domain/value-objects/tool-name.vo';
import { IntegrationTaskViewMapper } from '@integrations/infrastructure/acl/integration-task-view.mapper';
import { ToolDeclarationMapper } from '@integrations/infrastructure/acl/tool-declaration.mapper';
import { RunId } from '@shared-kernel/domain/value-objects/run-id.vo';
import { UserId } from '@shared-kernel/domain/value-objects/user-id.vo';
import type { IntegrationTaskViewDto } from '@work/application/dto/integration-task-view.dto';
import type {
  IntegrationTool,
  IntegrationToolCallsPort,
  RunAttemptDto,
  ToolCallFailureDto,
  ToolCallResultDto,
} from '@work/application/ports/integration-tool-calls.port';

const failureOf = (fact: CallFailureFact): ToolCallFailureDto => {
  switch (fact.kind) {
    case 'blocked':
      return { blocked: true, reason: fact.reason };
    case 'over-outbound-limit':
      return {
        blocked: false,
        reason: `${OUTBOUND_CALL}: ${outboundLimitReason(fact.perSecond)}`,
      };
    case 'upstream':
    case 'unknown':
      return { blocked: false, reason: fact.reason };
  }
};

const resultOf = (call: RunToolCall): ToolCallResultDto =>
  call.kind === 'answered'
    ? { outcome: 'answered', output: call.output }
    : { outcome: 'failed', failure: failureOf(call.fact) };

const toolOf = (found: RunTool): IntegrationTool => ({
  declared: ToolDeclarationMapper.toDeclaration(found.declared),
  actingAs: found.actingAs
    ? {
        actsAs: found.actingAs.actsAs,
        personId: found.actingAs.personId?.value ?? null,
        linkedAccount: found.actingAs.linkedAccount,
      }
    : null,
  personRule: found.personRule
    ? {
        rule: found.personRule.rule.name,
        personId: found.personRule.personId.value,
        personName: found.personRule.personName,
      }
    : null,
  missing: found.missing
    ? {
        integration: found.missing.integration.value,
        integrationName: found.missing.integrationName,
        personId: found.missing.personId?.value ?? null,
        because: found.missing.because,
      }
    : null,
  defaultFor: (input) => found.defaultFor(input),
  call: async (inputs) => resultOf(await found.call(inputs)),
});

export class IntegrationToolCalls implements IntegrationToolCallsPort {
  constructor(private readonly tools: ResolveToolForRun) {}

  async resolve(
    tool: string,
    task: IntegrationTaskViewDto,
    run: RunAttemptDto,
    requester: string | null,
  ): Promise<IntegrationTool | null> {
    const named = ToolName.parsed(tool);
    const found = named
      ? await this.tools.resolve(
          named,
          IntegrationTaskViewMapper.toView(task),
          RunAttemptRef.of(RunId.of(run.runId), run.attempt),
          requester ? UserId.of(requester) : null,
        )
      : null;

    return found ? toolOf(found) : null;
  }
}
