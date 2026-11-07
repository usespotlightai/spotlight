import type { DefinedIntegrationsPort } from '@integrations/application/ports/defined-integrations.port';
import type { InboxLinksPort } from '@integrations/application/ports/inbox-links.port';
import type {
  IntegrationRuntimePort,
  TaskPayload,
} from '@integrations/application/ports/integration-runtime.port';
import type {
  TaskView,
  UnlinkedTaskView,
} from '@integrations/application/ports/tasks-for-hooks.port';
import { askText } from '@integrations/application/rendering/task-notice-text';
import type { CallAuthResolver } from '@integrations/application/services/call-auth-resolver.service';
import type { LoggerPort } from '@shared-kernel/application/ports/logger.port';
import type { BindableTaskEvent } from '@work/application/contracts/bindable-task-events.contract';
import type { TaskMark } from '@work/application/contracts/happenings.contract';

export class NotifyTask {
  constructor(
    private readonly defined: DefinedIntegrationsPort,
    private readonly runtime: IntegrationRuntimePort,
    private readonly callAuthResolver: CallAuthResolver,
    private readonly links: InboxLinksPort,
    private readonly log: LoggerPort,
  ) {}

  async notify(
    task: UnlinkedTaskView,
    event: BindableTaskEvent,
  ): Promise<readonly TaskMark[]> {
    const teamId = task.teamId;
    const definitions = await this.defined.ofTeam(teamId);
    const posting = this.runtime
      .integrations(definitions)
      .filter((each) => each.postsOn(event));

    if (posting.length === 0) {
      return [];
    }

    const view: TaskView = {
      ...task,
      url: await this.links.task(task.workspaceId, task.teamId, task.taskId),
    };
    const payload: TaskPayload = { task: view, ask: await this.asking(view) };
    const addedMarks: TaskMark[] = [];

    for (const integration of posting) {
      try {
        const results = await this.runtime.post(
          definitions,
          integration,
          event,
          payload,
          await this.callAuthResolver.of(teamId, integration),
        );

        for (const posted of results) {
          if (posted.kind === 'posted') {
            addedMarks.push(...posted.marks);
          }

          if (posted.kind === 'failed') {
            this.log.warn(
              {
                task: task.taskId.value,
                error: posted.error,
                target: posted.target,
                marks: task.marks,
              },
              'A service answered a task notice with an error',
            );
          }
        }
      } catch (error) {
        this.log.warn(
          { err: error, task: task.taskId.value },
          'Posting a task notice to a service',
        );
      }
    }

    return addedMarks;
  }

  private async asking(task: TaskView): Promise<TaskPayload['ask']> {
    const { waiting: open } = task;
    const station = task.station.value;

    if (!open) {
      return { body: '', link: null, station, attachments: [] };
    }

    const link = await this.links.conversation(
      task.workspaceId,
      open.conversationId,
    );

    return {
      body: askText({
        written: open.body,
        station,
        link,
        awaitsApproval: open.awaitsApproval,
      }),
      link,
      station,
      attachments: open.attachments,
    };
  }
}
