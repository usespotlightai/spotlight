import {
  type RequesterLabel,
  requesterRefOf,
} from '@runs/application/ports/run-requester-labels.port';
import { RunRequesterLabels } from '@runs/application/services/run-requester-labels.service';
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

const LABEL: RequesterLabel = {
  title: 'Fix the queue',
  readers: { of: 'the-run', opens: true, hidden: 'Hidden task' },
};

describe('RunRequesterLabels', () => {
  it('asks each owner only for its own requesters', async () => {
    const asked: string[] = [];
    const labels = new RunRequesterLabels();
    labels.register({
      owner: 'work',
      labelsOf: async (requesters) => {
        asked.push(...requesters.map(requesterRefOf));
        return new Map([[requesterRefOf(task), LABEL]]);
      },
    });

    const found = await labels.labelsOf([task, replay]);

    expect(asked).toEqual(['work/task/task_1']);
    expect(found.get(requesterRefOf(task))).toEqual(LABEL);
  });

  it('labels nothing for an owner without a source', async () => {
    expect((await new RunRequesterLabels().labelsOf([replay])).size).toBe(0);
  });
});
