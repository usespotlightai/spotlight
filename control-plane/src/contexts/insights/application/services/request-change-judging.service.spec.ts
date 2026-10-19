import { RequestChangeJudging } from '@insights/application/services/request-change-judging.service';
import type { ChangeJudged } from '@insights/domain/events/change-judged.event';
import { ChangeJudgingsInMemory } from '@insights/domain/judging.fake-spec';
import { inTransaction } from '@insights/domain/runs.fake-spec';
import { JudgeEvidence } from '@insights/domain/services/judge-evidence';
import { RunId } from '@shared-kernel/domain/value-objects/run-id.vo';
import { TeamId } from '@shared-kernel/domain/value-objects/team-id.vo';
import { WorkspaceId } from '@shared-kernel/domain/value-objects/workspace-id.vo';
import { describe, expect, it } from 'vitest';

const NOW = new Date('2026-10-02T10:00:00.000Z');

const requesting = (available = true) => {
  const judgings = new ChangeJudgingsInMemory();
  const service = new RequestChangeJudging(
    judgings,
    {
      available,
      model: 'some/model',
      judge: async () => ({
        verdict: { value: true, reasons: [] },
        guidance: null,
        usage: null,
      }),
    },
    inTransaction,
    { now: () => NOW, sleep: async () => {} },
  );

  return { judgings, service };
};

const REQUEST = {
  runId: 'replay_1',
  workspaceId: 'ws_1',
  teamId: 'team_1',
  rubric: 'Did it drain the queue?' as string | null,
  claims: [] as readonly string[],
  passThreshold: 1,
  reference: 'original_1',
};

describe('RequestChangeJudging', () => {
  it('creates one pending judging of the change, however often it is requested', async () => {
    const { judgings, service } = requesting();

    expect(await service.request(REQUEST)).toBe('requested');
    expect(await service.request(REQUEST)).toBe('requested');

    const judging = await judgings.of(RunId.of('replay_1'), 1);
    expect(judgings.stored.size).toBe(1);
    expect(judging?.reference?.value).toBe('original_1');
    expect(judging?.scale.kind).toBe('yes-no');
  });

  it('judges claim by claim when the judge lists claims, with or without a rubric', async () => {
    const { judgings, service } = requesting();

    expect(
      await service.request({
        ...REQUEST,
        rubric: null,
        claims: ['It drains in order.', 'It adds a test.'],
        passThreshold: 0.5,
      }),
    ).toBe('requested');

    const judging = await judgings.of(RunId.of('replay_1'), 1);
    expect(judging?.scale.kind).toBe('claims');
    expect(judging?.criteria.claims).toHaveLength(2);
    expect(judging?.criteria.passThreshold).toBe(0.5);
  });

  it('says it cannot read a judge with neither a rubric nor claims', async () => {
    const { service } = requesting();

    expect(await service.request({ ...REQUEST, rubric: null })).toBe(
      'unreadable-rubric',
    );
  });

  it('says no judge is available without one', async () => {
    const { judgings, service } = requesting(false);

    expect(await service.request(REQUEST)).toBe('unavailable');
    expect(judgings.stored.size).toBe(0);
  });

  it('says it cannot read a rubric whose scale it does not know, or a blank one', async () => {
    const { service } = requesting();

    expect(
      await service.request({ ...REQUEST, rubric: 'scores: stars\nGood?' }),
    ).toBe('unreadable-rubric');
    expect(await service.request({ ...REQUEST, rubric: '  ' })).toBe(
      'unreadable-rubric',
    );
  });

  it('is deleted with the team it was requested for', async () => {
    const { judgings, service } = requesting();

    await service.request(REQUEST);
    await service.request({ ...REQUEST, runId: 'replay_2', teamId: 'team_2' });
    await judgings.removeForTeam(WorkspaceId.of('ws_1'), TeamId.of('team_1'));

    expect([...judgings.stored.keys()]).toEqual(['replay_2#1']);
  });
});

const judgedAs = async (
  judgings: ChangeJudgingsInMemory,
  attempt: 1 | 2,
  value: boolean,
): Promise<void> => {
  const run = RunId.of('replay_1');
  const judging = await judgings.of(run, attempt);

  if (!judging) {
    throw new Error('no judging is pending');
  }
  await judgings.save(judging.leaseJob(NOW));

  const leased = await judgings.of(run, attempt);

  if (!leased) {
    throw new Error('the judging went');
  }
  await judgings.save(
    leased.recordVerdict({
      verdict: {
        value,
        reasons: [{ text: 'It drains.', steps: [2], hunks: [] }],
      },
      guidance: null,
      usage: null,
      evidence: JudgeEvidence.of({
        runId: run,
        title: 'Drain',
        description: null,
        steps: [
          {
            index: 2,
            kind: 'message',
            tool: null,
            text: 'Draining it in order.',
            input: null,
            output: null,
          },
        ],
        hunks: [],
      }),
      model: 'some/model',
      now: NOW,
    }),
  );
};

describe('RequestChangeJudging, requeued', () => {
  const judgedOnce = async () => {
    const requested = requesting();

    await requested.service.request(REQUEST);
    await judgedAs(requested.judgings, 1, true);
    requested.judgings.events.length = 0;

    return requested;
  };

  it('creates one pending second judging with the first rubric and reference, however often it is requested', async () => {
    const { judgings, service } = await judgedOnce();

    expect(await service.requeue('replay_1')).toBe('requested');
    expect(await service.requeue('replay_1')).toBe('requested');

    const second = await judgings.of(RunId.of('replay_1'), 2);
    expect(judgings.stored.size).toBe(2);
    expect(second?.attempt).toBe(2);
    expect(second?.hasPendingJob).toBe(true);
    expect(second?.criteria.rubric).toBe(REQUEST.rubric);
    expect(second?.reference?.value).toBe('original_1');
    expect((await judgings.of(RunId.of('replay_1'), 1))?.judgedAt).toEqual(NOW);
  });

  it('requeues nothing for a change not yet judged', async () => {
    const { judgings, service } = requesting();

    await service.request(REQUEST);

    expect(await service.requeue('replay_1')).toBe('unjudged');
    expect(await service.requeue('replay_9')).toBe('unjudged');
    expect(judgings.stored.size).toBe(1);
  });

  it('says which attempt a verdict is from', async () => {
    const { judgings, service } = await judgedOnce();

    await service.requeue('replay_1');
    await judgedAs(judgings, 2, false);

    expect(
      (judgings.events as ChangeJudged[]).map((each) => [
        each.kind,
        each.attempt,
        each.value,
      ]),
    ).toEqual([['change-judging.judged', 2, 0]]);
  });
});
