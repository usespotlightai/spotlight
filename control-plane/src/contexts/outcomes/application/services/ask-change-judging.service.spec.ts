import { AskChangeJudging } from '@outcomes/application/services/ask-change-judging.service';
import { ChangeJudgingsInMemory } from '@outcomes/domain/judging.fake-spec';
import { inTransaction } from '@outcomes/domain/outcomes.fake-spec';
import { RunId } from '@shared-kernel/domain/value-objects/run-id.vo';
import { TeamId } from '@shared-kernel/domain/value-objects/team-id.vo';
import { WorkspaceId } from '@shared-kernel/domain/value-objects/workspace-id.vo';
import { describe, expect, it } from 'vitest';

const NOW = new Date('2026-10-02T10:00:00.000Z');

const asking = (available = true) => {
  const judgings = new ChangeJudgingsInMemory();
  const service = new AskChangeJudging(
    judgings,
    {
      available,
      model: 'some/model',
      judge: async () => ({
        verdict: { value: true, reasons: [] },
        usage: null,
      }),
    },
    inTransaction,
    { now: () => NOW, sleep: async () => {} },
  );

  return { judgings, service };
};

const ASK = {
  runId: 'replay_1',
  workspaceId: 'ws_1',
  teamId: 'team_1',
  rubric: 'Did it drain the queue?',
  reference: 'original_1',
};

describe('AskChangeJudging', () => {
  it('owes a judging of the change, once however often it is asked', async () => {
    const { judgings, service } = asking();

    expect(await service.ask(ASK)).toBe('asked');
    expect(await service.ask(ASK)).toBe('asked');

    const held = await judgings.of(RunId.of('replay_1'));
    expect(judgings.held.size).toBe(1);
    expect(held?.reference?.value).toBe('original_1');
    expect(held?.scale.kind).toBe('yes-no');
  });

  it('says no judge is there to ask without one', async () => {
    const { judgings, service } = asking(false);

    expect(await service.ask(ASK)).toBe('unavailable');
    expect(judgings.held.size).toBe(0);
  });

  it('says it cannot read a rubric whose scale it does not know, or a blank one', async () => {
    const { service } = asking();

    expect(await service.ask({ ...ASK, rubric: 'scores: stars\nGood?' })).toBe(
      'unreadable-rubric',
    );
    expect(await service.ask({ ...ASK, rubric: '  ' })).toBe(
      'unreadable-rubric',
    );
  });

  it('is forgotten with the team it was asked for', async () => {
    const { judgings, service } = asking();

    await service.ask(ASK);
    await service.ask({ ...ASK, runId: 'replay_2', teamId: 'team_2' });
    await judgings.removeForTeam(WorkspaceId.of('ws_1'), TeamId.of('team_1'));

    expect([...judgings.held.keys()]).toEqual(['replay_2']);
  });
});
