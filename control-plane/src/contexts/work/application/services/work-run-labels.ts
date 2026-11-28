import {
  type LabelledRequester,
  type RequesterLabel,
  type RunRequesterLabelSource,
  requesterRefOf,
} from '@runs/application/ports/run-requester-labels.port';
import { TeamId } from '@shared-kernel/domain/value-objects/team-id.vo';
import type { WorkTitlesReaderPort } from '@work/application/ports/work-titles-reader.port';
import {
  CHAT_RUN_HIDDEN,
  DELETED_CHAT_TITLE,
  DELETED_TASK_TITLE,
  TASK_RUN_HIDDEN,
} from '@work/application/rendering/run-labels';
import { WorkRequesters } from '@work/application/services/work-requesters';

/**
 * Names each task and chat run by its task or chat. Whoever reads the run sees it, and a task run's title opens it. A
 * task run is kept from those off its team, a chat run from all but the person who started the chat. Once a chat is
 * gone, no one owns it, so the members of its team see that it is deleted.
 */
export class WorkRunLabels implements RunRequesterLabelSource {
  readonly owner = WorkRequesters.owner;

  constructor(private readonly titles: WorkTitlesReaderPort) {}

  async labelsOf(
    requesters: readonly LabelledRequester[],
  ): Promise<ReadonlyMap<string, RequesterLabel>> {
    const tasks = requesters.flatMap((each) => {
      const taskId = WorkRequesters.taskOf(each);
      return taskId ? [{ requester: each, id: taskId.value }] : [];
    });
    const chats = requesters.flatMap((each) => {
      const chatId = WorkRequesters.chatOf(each);
      return chatId ? [{ requester: each, id: chatId.value }] : [];
    });
    const [taskTitles, chatTitles] = await Promise.all([
      this.titles.taskTitles(tasks.map((each) => each.id)),
      this.titles.chatTitles(chats.map((each) => each.id)),
    ]);

    const chatLabelOf = (
      requester: LabelledRequester,
      title: string | undefined,
    ): RequesterLabel =>
      title === undefined && requester.team !== null
        ? {
            title: DELETED_CHAT_TITLE,
            readers: {
              of: 'team-members',
              teamId: TeamId.of(requester.team),
            },
          }
        : {
            title: title ?? DELETED_CHAT_TITLE,
            readers: { of: 'the-run', opens: false, hidden: CHAT_RUN_HIDDEN },
          };

    return new Map<string, RequesterLabel>([
      ...tasks.map(
        ({ requester, id }) =>
          [
            requesterRefOf(requester),
            {
              title: taskTitles.get(id) ?? DELETED_TASK_TITLE,
              readers: { of: 'the-run', opens: true, hidden: TASK_RUN_HIDDEN },
            },
          ] as const,
      ),
      ...chats.map(
        ({ requester, id }) =>
          [
            requesterRefOf(requester),
            chatLabelOf(requester, chatTitles.get(id)),
          ] as const,
      ),
    ]);
  }
}
