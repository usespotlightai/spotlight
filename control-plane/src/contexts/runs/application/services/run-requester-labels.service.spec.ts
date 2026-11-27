import { requesterRefOf } from '@runs/application/ports/run-requester-labels.port';
import { RunRequesterLabels } from '@runs/application/services/run-requester-labels.service';
import { UserId } from '@shared-kernel/domain/value-objects/user-id.vo';
import { describe, expect, it } from 'vitest';

const task = {
  owner: 'work',
  kind: 'task',
  id: 'task_1',
  token: '2',
  team: 'team_1',
};
const replay = {
  owner: 'replays',
  kind: 'replay',
  id: 'run_9',
  token: null,
  team: 'team_1',
};

const VIEWER = UserId.of('user_1');

describe('RunRequesterLabels', () => {
  it('asks each owner only for its own requesters', async () => {
    const asked: string[] = [];
    const labels = new RunRequesterLabels();
    labels.register({
      owner: 'work',
      checksViewer: false,
      labelsOf: async (requesters, viewer) => {
        asked.push(...requesters.map(requesterRefOf), viewer.value);
        return new Map([
          [requesterRefOf(task), { title: 'Fix the queue', station: null }],
        ]);
      },
    });

    const found = await labels.labelsOf([task, replay], VIEWER);

    expect(asked).toEqual(['work/task/task_1', 'user_1']);
    expect(found.get(requesterRefOf(task))).toEqual({
      title: 'Fix the queue',
      station: null,
      checkedForViewer: false,
    });
  });

  it('labels nothing for an owner without a source', async () => {
    expect(
      (await new RunRequesterLabels().labelsOf([replay], VIEWER)).size,
    ).toBe(0);
  });
});
