import { AskChangeJudging } from '@outcomes/application/services/ask-change-judging.service';
import type { ChangeJudged } from '@outcomes/domain/events/change-judged.event';
import { ChangeJudgingsInMemory } from '@outcomes/domain/judging.fake-spec';
import { inTransaction } from '@outcomes/domain/outcomes.fake-spec';
import { JudgeEvidence } from '@outcomes/domain/services/judge-evidence';
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
  rubric: 'Did it drain the queue?' as string | null,
  claims: [] as readonly string[],
  passShare: 1,
  reference: 'original_1',
};

describe('AskChangeJudging', () => {
  it('owes a judging of the change, once however often it is asked', async () => {
    const { judgings, service } = asking();

    expect(await service.ask(ASK)).toBe('asked');
    expect(await service.ask(ASK)).toBe('asked');

    const held = await judgings.of(RunId.of('replay_1'), 1);
    expect(judgings.held.size).toBe(1);
    expect(held?.reference?.value).toBe('original_1');
    expect(held?.scale.kind).toBe('yes-no');
  });

  it('judges claim by claim when the judge lists claims, with or without a rubric', async () => {
    const { judgings, service } = asking();

    expect(
      await service.ask({
        ...ASK,
        rubric: null,
        claims: ['It drains in order.', 'It adds a test.'],
        passShare: 0.5,
      }),
    ).toBe('asked');

    const held = await judgings.of(RunId.of('replay_1'), 1);
    expect(held?.scale.kind).toBe('claims');
    expect(held?.criteria.claims).toHaveLength(2);
    expect(held?.criteria.passShare).toBe(0.5);
  });

  it('says it cannot read a judge with neither a rubric nor claims', async () => {
    const { service } = asking();

    expect(await service.ask({ ...ASK, rubric: null })).toBe(
      'unreadable-rubric',
    );
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

    expect([...judgings.held.keys()]).toEqual(['replay_2#1']);
  });
});

const judgedAs = async (
  judgings: ChangeJudgingsInMemory,
  round: 1 | 2,
  value: boolean,
): Promise<void> => {
  const run = RunId.of('replay_1');
  const owed = await judgings.of(run, round);

  if (!owed) {
    throw new Error('no judging was owed');
  }
  await judgings.save(owed.leased(NOW));

  const leased = await judgings.of(run, round);

  if (!leased) {
    throw new Error('the judging went');
  }
  await judgings.save(
    leased.recordVerdict({
      verdict: {
        value,
        reasons: [{ text: 'It drains.', steps: [2], hunks: [] }],
      },
      usage: null,
      evidence: JudgeEvidence.of({
        runId: run,
        title: 'Drain',
        description: null,
        steps: [
          {
            index: 2,
            kind: 'said',
            tool: null,
            text: 'Draining it in order.',
            given: null,
            returned: null,
          },
        ],
        hunks: [],
      }),
      model: 'some/model',
      now: NOW,
    }),
  );
};

describe('AskChangeJudging, asked again', () => {
  const judgedOnce = async () => {
    const asked = asking();

    await asked.service.ask(ASK);
    await judgedAs(asked.judgings, 1, true);
    asked.judgings.events.length = 0;

    return asked;
  };

  it('owes a second judging of a change judged once, with the first one’s rubric and reference, once however often it is asked', async () => {
    const { judgings, service } = await judgedOnce();

    expect(await service.askAgain('replay_1')).toBe('asked');
    expect(await service.askAgain('replay_1')).toBe('asked');

    const second = await judgings.of(RunId.of('replay_1'), 2);
    expect(judgings.held.size).toBe(2);
    expect(second?.round).toBe(2);
    expect(second?.owesWork).toBe(true);
    expect(second?.criteria.rubric).toBe(ASK.rubric);
    expect(second?.reference?.value).toBe('original_1');
    expect((await judgings.of(RunId.of('replay_1'), 1))?.judgedAt).toEqual(NOW);
  });

  it('asks nothing again of a change not yet judged', async () => {
    const { judgings, service } = asking();

    await service.ask(ASK);

    expect(await service.askAgain('replay_1')).toBe('unjudged');
    expect(await service.askAgain('replay_9')).toBe('unjudged');
    expect(judgings.held.size).toBe(1);
  });

  it('says which round a verdict is from', async () => {
    const { judgings, service } = await judgedOnce();

    await service.askAgain('replay_1');
    await judgedAs(judgings, 2, false);

    expect(
      (judgings.events as ChangeJudged[]).map((each) => [
        each.kind,
        each.round,
        each.value,
      ]),
    ).toEqual([['change-judging.judged', 2, 0]]);
  });
});
