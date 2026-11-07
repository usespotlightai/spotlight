import type {
  ResolveToolForRun,
  RunTool,
} from '@integrations/application/services/resolve-tool-for-run.service';
import { IntegrationTaskViewMapper } from '@integrations/infrastructure/acl/integration-task-view.mapper';
import { UserId } from '@shared-kernel/domain/value-objects/user-id.vo';
import type { IntegrationTaskViewDto } from '@work/application/dto/integration-task-view.dto';
import type {
  IntegrationTool,
  IntegrationToolCallsPort,
  RunAttemptDto,
} from '@work/application/ports/integration-tool-calls.port';

const toolOf = (found: RunTool): IntegrationTool => ({
  declared: found.declared,
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
  call: (inputs) => found.call(inputs),
});

export class IntegrationToolCalls implements IntegrationToolCallsPort {
  constructor(private readonly tools: ResolveToolForRun) {}

  async resolve(
    tool: string,
    task: IntegrationTaskViewDto,
    run: RunAttemptDto,
    requester: string | null,
  ): Promise<IntegrationTool | null> {
    const found = await this.tools.resolve(
      tool,
      IntegrationTaskViewMapper.toView(task, null),
      run,
      requester ? UserId.of(requester) : null,
    );

    return found ? toolOf(found) : null;
  }
}
