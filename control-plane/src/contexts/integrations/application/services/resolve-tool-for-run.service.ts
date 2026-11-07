import { RecordToolOutputCommand } from '@integrations/application/commands/record-tool-output.command';
import type { DefinedIntegrationsPort } from '@integrations/application/ports/defined-integrations.port';
import type { InboxLinksPort } from '@integrations/application/ports/inbox-links.port';
import type {
  IntegrationRuntimePort,
  IntegrationTaskView,
  ToolOutput,
} from '@integrations/application/ports/integration-runtime.port';
import type { CallAuthResolver } from '@integrations/application/services/call-auth-resolver.service';
import type {
  PersonToolRuleRecord,
  PersonToolRules,
} from '@integrations/application/services/person-tool-rules.service';
import {
  type ActingAs,
  ConnectionChoice,
} from '@integrations/domain/services/connection-choice';
import type { ConnectionMissing } from '@integrations/domain/value-objects/connection-missing.vo';
import type { CommandHandlerPort } from '@shared-kernel/application/ports/command-handler.port';
import type { LoggerPort } from '@shared-kernel/application/ports/logger.port';
import { InconsistentStateError } from '@shared-kernel/domain/exceptions/inconsistent-state.error';
import { TeamId } from '@shared-kernel/domain/value-objects/team-id.vo';
import type { UserId } from '@shared-kernel/domain/value-objects/user-id.vo';
import type {
  ToolDeclaration,
  ToolInputValues,
} from '@work/application/contracts/tools.contract';

export interface RunAttempt {
  readonly runId: string;
  readonly attempt: number;
}

export interface RunTool {
  readonly declared: ToolDeclaration;
  readonly actingAs: ActingAs | null;
  readonly missing: ConnectionMissing | null;
  readonly personRule: PersonToolRuleRecord | null;
  defaultFor(input: string): unknown;
  call(inputs: ToolInputValues): Promise<ToolOutput>;
}

export class ResolveToolForRun {
  constructor(
    private readonly defined: DefinedIntegrationsPort,
    private readonly runtime: IntegrationRuntimePort,
    private readonly callAuthResolver: CallAuthResolver,
    private readonly personRules: PersonToolRules,
    private readonly links: InboxLinksPort,
    private readonly recording: CommandHandlerPort<
      RecordToolOutputCommand,
      void
    >,
    private readonly logger: LoggerPort,
  ) {}

  async resolve(
    tool: string,
    task: IntegrationTaskView,
    run: RunAttempt,
    requester: UserId | null,
  ): Promise<RunTool | null> {
    const teamId = TeamId.of(task.teamId);
    const definitions = await this.defined.ofTeam(teamId);
    const resolved = await this.runtime.tool(definitions, tool, {
      ...task,
      url: await this.links.task(task.workspaceId, task.teamId, task.taskId),
    });

    if (!resolved) {
      return null;
    }

    const found = await this.callAuthResolver.connectionFor(
      teamId,
      resolved.integration,
      requester,
    );

    if (found.kind === 'missing') {
      return {
        declared: resolved.declared,
        actingAs: null,
        personRule: null,
        missing: found.missing,
        defaultFor: (input) => resolved.defaultFor(input),
        call: async () => {
          throw new InconsistentStateError(
            'integration tool',
            `${tool} was called without the connection it acts with`,
          );
        },
      };
    }

    return {
      declared: resolved.declared,
      personRule: await this.personRules.ruleFor(
        teamId,
        resolved.integration.key,
        found.owner,
        tool,
      ),
      actingAs: ConnectionChoice.actingAs(
        resolved.integration,
        found.owner,
        found.connection,
      ),
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

        this.recording
          .execute(new RecordToolOutputCommand(teamId, tool, answer))
          .catch((error: unknown) =>
            this.logger.debug(
              { tool, err: error },
              'Could not record what a tool answered',
            ),
          );

        return answer;
      },
    };
  }
}
