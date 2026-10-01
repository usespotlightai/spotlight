import { OutcomesAccess } from '@outcomes/application/services/outcomes-access.service';
import {
  MOST_RECORDS,
  TeamHistories,
} from '@outcomes/application/services/team-histories.service';
import {
  ChatRecordsInMemory,
  chatOf,
  TaskFailuresInMemory,
  TaskTouchesInMemory,
} from '@outcomes/domain/insights.fake-spec';
import {
  endedRecord,
  RunRecordsInMemory,
  TaskDeliveriesInMemory,
  WORKSPACE,
} from '@outcomes/domain/outcomes.fake-spec';
import { PersonPrincipal } from '@shared-kernel/domain/value-objects/principal.vo';
import { UserId } from '@shared-kernel/domain/value-objects/user-id.vo';
import { describe, expect, it } from 'vitest';

const NOW = new Date('2026-10-01T15:00:00.000Z');
const ADA = PersonPrincipal.of(UserId.of('user_ada'));

const historiesOver = async (runs: number, started = 0) => {
  const records = new RunRecordsInMemory();
  const chats = new ChatRecordsInMemory();
  const start = new Date('2026-09-25T00:00:00.000Z').getTime();

  for (let at = 0; at < runs; at += 1) {
    await records.add(
      endedRecord(`run_${at}`, {
        taskId: `task_${at}`,
        endedAt: new Date(start + at * 1_000),
      }),
    );
  }

  for (let at = 0; at < started; at += 1) {
    await chats.add(
      chatOf(`chat_${at}`, 'user_ada', new Date(start + at * 1_000)),
    );
  }

  return new TeamHistories(
    new OutcomesAccess({
      clearedOnTeam: async () => ({
        workspaceId: WORKSPACE,
        by: UserId.of('user_ada'),
      }),
      namesOf: async () => new Map(),
    }),
    {
      records,
      deliveries: new TaskDeliveriesInMemory(),
      touches: new TaskTouchesInMemory(records),
      failures: new TaskFailuresInMemory(),
      chats,
    },
    { now: () => NOW, sleep: async () => {} },
  );
};

describe('TeamHistories', () => {
  it('counts every run while there are no more than it loads at once', async () => {
    const held = await (await historiesOver(3)).of('team_1', ADA, '7d');

    expect(held.truncated).toBe(false);
    expect(held.history.records).toHaveLength(3);
  });

  it('loads only the latest runs past its ceiling, and says it left the rest out', async () => {
    const held = await (await historiesOver(MOST_RECORDS + 1)).of(
      'team_1',
      ADA,
      '7d',
    );

    expect(held.truncated).toBe(true);
    expect(held.history.records).toHaveLength(MOST_RECORDS);
    expect(held.history.records[0]?.runId.value).toBe('run_1');
  });

  it('says it left some out when the team started more chats than it loads at once', async () => {
    const held = await (await historiesOver(3, MOST_RECORDS + 1)).of(
      'team_1',
      ADA,
      '7d',
    );

    expect(held.truncated).toBe(true);
    expect(held.history.records).toHaveLength(3);
    expect(held.history.chats).toHaveLength(MOST_RECORDS);
  });
});
