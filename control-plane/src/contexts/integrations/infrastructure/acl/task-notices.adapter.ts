import { integrationFilesIn } from '@configuration/application/contracts/configuration-layout.contract';
import type { AppliedConfigurationPort } from '@configuration/application/ports/applied-configuration.port';
import type { InboxLinksPort } from '@integrations/application/ports/inbox-links.port';
import type {
  BoundTask,
  IntegrationRuntimePort,
  TaskWord,
} from '@integrations/application/ports/integration-runtime.port';
import type { HostReach } from '@integrations/application/services/host-reach.service';
import { BoundTaskMapper } from '@integrations/infrastructure/acl/bound-task.mapper';
import type { LoggerPort } from '@shared-kernel/application/ports/logger.port';
import { TeamId } from '@shared-kernel/domain/value-objects/team-id.vo';
import type { MarkWorn } from '@work/application/contracts/happenings.contract';
import type { BoundTaskDto } from '@work/application/dto/bound-task.dto';
import type { TaskNoticesPort } from '@work/application/ports/task-notices.port';

const waiting = (station: string, link: string | null): string => {
  const where = station ? ` at ${station}` : '';

  return `A task${where} is waiting on you.${link ? ` ${link}` : ''}`;
};

export class TaskNotices implements TaskNoticesPort {
  constructor(
    private readonly configurations: AppliedConfigurationPort,
    private readonly runtime: IntegrationRuntimePort,
    private readonly reach: HostReach,
    private readonly links: InboxLinksPort,
    private readonly log: LoggerPort,
  ) {}

  async notify(
    task: BoundTaskDto,
    event: string,
  ): Promise<readonly MarkWorn[]> {
    const teamId = TeamId.of(task.teamId);
    const applied = await this.configurations.of(teamId);

    if (!applied) {
      return [];
    }

    const files = integrationFilesIn(applied.files);
    const posting = this.runtime
      .integrations(files)
      .filter((each) => each.postsOn(event));

    if (posting.length === 0) {
      return [];
    }

    const bound = BoundTaskMapper.toBound(task);
    const word: TaskWord = { task: bound, ask: await this.asking(bound) };
    const kept: MarkWorn[] = [];

    for (const integration of posting) {
      try {
        const posted = await this.runtime.post(
          files,
          integration,
          event,
          word,
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

  private async asking(task: BoundTask): Promise<TaskWord['ask']> {
    const { station, waiting: open } = task;

    if (!open) {
      return { body: '', link: null, station };
    }

    const link = await this.links.conversation(
      task.workspaceId,
      open.conversationId,
    );

    return { body: open.said || waiting(station, link), link, station };
  }
}
