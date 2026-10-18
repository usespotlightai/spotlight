import type { DefinedIntegrationsPort } from '@integrations/application/ports/defined-integrations.port';
import type { InboxLinksPort } from '@integrations/application/ports/inbox-links.port';
import type {
  IntegrationRuntimePort,
  IntegrationTaskView,
  TaskPayload,
} from '@integrations/application/ports/integration-runtime.port';
import type { CallAuthResolver } from '@integrations/application/services/call-auth-resolver.service';
import { IntegrationTaskViewMapper } from '@integrations/infrastructure/acl/integration-task-view.mapper';
import type { LoggerPort } from '@shared-kernel/application/ports/logger.port';
import { TeamId } from '@shared-kernel/domain/value-objects/team-id.vo';
import type { TaskMark } from '@work/application/contracts/happenings.contract';
import type { IntegrationTaskViewDto } from '@work/application/dto/integration-task-view.dto';
import type { TaskNoticesPort } from '@work/application/ports/task-notices.port';

const waiting = (station: string, link: string | null): string => {
  const where = station ? ` at ${station}` : '';

  return `A task${where} is waiting on you.${link ? ` ${link}` : ''}`;
};

const decidedAt = (link: string | null): string =>
  link
    ? `Approve or reject it in Spotlight: ${link}`
    : 'Approve or reject it in your Spotlight inbox.';

export class TaskNotices implements TaskNoticesPort {
  constructor(
    private readonly defined: DefinedIntegrationsPort,
    private readonly runtime: IntegrationRuntimePort,
    private readonly callAuthResolver: CallAuthResolver,
    private readonly links: InboxLinksPort,
    private readonly log: LoggerPort,
  ) {}

  async notify(
    task: IntegrationTaskViewDto,
    event: string,
  ): Promise<readonly TaskMark[]> {
    const teamId = TeamId.of(task.teamId);
    const definitions = await this.defined.ofTeam(teamId);
    const posting = this.runtime
      .integrations(definitions)
      .filter((each) => each.postsOn(event));

    if (posting.length === 0) {
      return [];
    }

    const view = IntegrationTaskViewMapper.toView(task);
    const payload: TaskPayload = { task: view, ask: await this.asking(view) };
    const addedMarks: TaskMark[] = [];

    for (const integration of posting) {
      try {
        const posted = await this.runtime.post(
          definitions,
          integration,
          event,
          payload,
          await this.callAuthResolver.of(teamId, integration),
        );

        if (posted.kind === 'posted') {
          addedMarks.push(...posted.marks);
        }

        if (posted.kind === 'failed') {
          this.log.warn(
            {
              task: task.taskId,
              error: posted.error,
              target: posted.target,
              marks: task.marks,
            },
            'A service answered a task’s word with an error',
          );
        }
      } catch (error) {
        this.log.warn(
          { err: error, task: task.taskId },
          'Posting a task’s word to a service',
        );
      }
    }

    return addedMarks;
  }

  private async asking(task: IntegrationTaskView): Promise<TaskPayload['ask']> {
    const { station, waiting: open } = task;

    if (!open) {
      return { body: '', link: null, station };
    }

    const link = await this.links.conversation(
      task.workspaceId,
      open.conversationId,
    );

    const body = open.body || waiting(station, link);

    return {
      body: open.awaitsApproval ? `${body}\n\n${decidedAt(link)}` : body,
      link,
      station,
    };
  }
}
