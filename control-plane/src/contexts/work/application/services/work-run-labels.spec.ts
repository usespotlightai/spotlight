import { TaskId } from '@shared-kernel/domain/value-objects/task-id.vo';
import { TeamId } from '@shared-kernel/domain/value-objects/team-id.vo';
import { WorkRequesters } from '@work/application/services/work-requesters';
import { WorkRunLabels } from '@work/application/services/work-run-labels';
import { ChatId } from '@work/domain/value-objects/chat-id.vo';
import { TaskRevision } from '@work/domain/value-objects/task-revision.vo';
import { describe, expect, it } from 'vitest';

const TEAM = TeamId.of('team_1');

const labels = new WorkRunLabels({
  taskTitles: async (ids) =>
    new Map(ids.includes('task_1') ? [['task_1', 'Fix the queue']] : []),
  chatTitles: async (ids) =>
    new Map(ids.includes('chat_1') ? [['chat_1', 'Plan the migration']] : []),
});

describe('WorkRunLabels', () => {
  it('names a task run by its task, opening it, and a chat run by its chat, for whoever reads the run', async () => {
    const found = await labels.labelsOf([
      WorkRequesters.task(TaskId.of('task_1'), TaskRevision.of(1), TEAM),
      WorkRequesters.chat(ChatId.of('chat_1'), TEAM),
    ]);

    expect(found.get('work/task/task_1')).toEqual({
      title: 'Fix the queue',
      readers: {
        of: 'the-run',
        opens: true,
        hidden: 'Title hidden. This run belongs to a team you’re not on.',
      },
    });
    expect(found.get('work/chat/chat_1')).toEqual({
      title: 'Plan the migration',
      readers: {
        of: 'the-run',
        opens: false,
        hidden:
          'Title hidden. Only the person who started the agent chat sees it.',
      },
    });
  });

  it('says a task or chat is deleted when it is gone, showing a gone chat to its team', async () => {
    const found = await labels.labelsOf([
      WorkRequesters.task(TaskId.of('task_gone'), TaskRevision.of(1), TEAM),
      WorkRequesters.chat(ChatId.of('chat_gone'), TEAM),
    ]);

    expect(found.get('work/task/task_gone')?.title).toBe('Deleted task');
    expect(found.get('work/chat/chat_gone')).toEqual({
      title: 'Deleted agent chat',
      readers: { of: 'team-members', teamId: TEAM },
    });
  });
});
