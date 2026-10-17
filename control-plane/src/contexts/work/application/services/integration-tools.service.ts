import { PersonRuleMapper } from '@work/application/mappers/person-rule.mapper';
import { ToolActingAsMapper } from '@work/application/mappers/tool-acting-as.mapper';
import { ToolDeclarationMapper } from '@work/application/mappers/tool-declaration.mapper';
import type { IntegrationToolCallsPort } from '@work/application/ports/integration-tool-calls.port';
import type {
  IntegrationToolsPort,
  ResolvedTool,
  ToolContext,
} from '@work/application/ports/integration-tools.port';
import type { IntegrationTaskViews } from '@work/application/services/integration-task-views.service';
import type { RunWorks } from '@work/application/services/run-works.service';
import type { LineRepository } from '@work/domain/repositories/line.repository';
import type { TaskRepository } from '@work/domain/repositories/task.repository';
import type { RunAttempt } from '@work/domain/value-objects/run-attempt.vo';
import type { Tool } from '@work/domain/value-objects/tool.vo';

export class IntegrationTools implements IntegrationToolsPort {
  constructor(
    private readonly tasks: TaskRepository,
    private readonly lines: LineRepository,
    private readonly taskViews: IntegrationTaskViews,
    private readonly calls: IntegrationToolCallsPort,
    private readonly works: RunWorks,
  ) {}

  async resolve(
    tool: Tool,
    context: ToolContext,
    attempt: RunAttempt,
    runnerId: string,
  ): Promise<ResolvedTool | null> {
    if (context.kind !== 'task') {
      return null;
    }

    const [task, line] = await Promise.all([
      this.tasks.find(context.taskId),
      this.lines.findByStation(context.stationId),
    ]);
    const view = task && line ? await this.taskViews.of(task, line) : null;
    const found = view
      ? await this.calls.resolve(
          tool.value,
          view,
          { runId: attempt.runId.value, attempt: attempt.number },
          context.requester?.value ?? null,
        )
      : null;

    return found
      ? {
          declared: ToolDeclarationMapper.toDeclared(found.declared),
          actingAs: found.actingAs
            ? ToolActingAsMapper.toActingAs(found.actingAs)
            : null,
          missing: found.missing,
          personRule: found.personRule
            ? PersonRuleMapper.toRule(found.personRule)
            : null,
          defaultFor: (input) => found.defaultFor(input.name),
          call: async (inputs) => {
            await this.works.stillOn(attempt, runnerId);
            return found.call(inputs.values);
          },
        }
      : null;
  }
}
