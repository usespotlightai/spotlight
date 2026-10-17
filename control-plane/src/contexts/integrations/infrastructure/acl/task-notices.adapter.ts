import type { DefinedIntegrationsPort } from '@integrations/application/ports/defined-integrations.port';
import type { InboxLinksPort } from '@integrations/application/ports/inbox-links.port';
import type {
  BoundTask,
  IntegrationRuntimePort,
  TaskPayload,
} from '@integrations/application/ports/integration-runtime.port';
import type { HostReach } from '@integrations/application/services/host-reach.service';
import { BoundTaskMapper } from '@integrations/infrastructure/acl/bound-task.mapper';
import type { LoggerPort } from '@shared-kernel/application/ports/logger.port';
import { TeamId } from '@shared-kernel/domain/value-objects/team-id.vo';
import type { TaskMark } from '@work/application/contracts/happenings.contract';
import type { BoundTaskDto } from '@work/application/dto/bound-task.dto';
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
    private readonly reach: HostReach,
    private readonly links: InboxLinksPort,
    private readonly log: LoggerPort,
  ) {}

  async notify(
    task: BoundTaskDto,
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

    const bound = BoundTaskMapper.toBound(task);
    const payload: TaskPayload = { task: bound, ask: await this.asking(bound) };
    const kept: TaskMark[] = [];

    for (const integration of posting) {
      try {
        const posted = await this.runtime.post(
          definitions,
          integration,
          event,
          payload,
          await this.reach.of(teamId, integration),
        );

        if (posted.kind === 'posted') {
          kept.push(...posted.marks);
        }

        if (posted.kind === 'refused') {
          this.log.warn(
            {
              task: task.taskId,
              refusal: posted.refusal,
              target: posted.target,
              marks: task.marks,
            },
            'A host refused a task’s word',
          );
        }
      } catch (error) {
        this.log.warn(
          { err: error, task: task.taskId },
          'Posting a task’s word to a host',
        );
      }
    }

    return kept;
  }

  private async asking(task: BoundTask): Promise<TaskPayload['ask']> {
    const { station, waiting: open } = task;

    if (!open) {
      return { body: '', link: null, station };
    }

    const link = await this.links.conversation(
      task.workspaceId,
      open.conversationId,
    );

    const body = open.said || waiting(station, link);

    return {
      body: open.awaitsApproval ? `${body}\n\n${decidedAt(link)}` : body,
      link,
      station,
    };
  }
}
