import type { EndedRun } from '@outcomes/application/ports/work.port';
import { AskForJudging } from '@outcomes/application/services/ask-for-judging.service';
import { ForgetOutcomes } from '@outcomes/application/services/forget-outcomes.service';
import { GradeAsides } from '@outcomes/application/services/grade-asides.service';
import { NoteChangeChecked } from '@outcomes/application/services/note-change-checked.service';
import { NotePersonAct } from '@outcomes/application/services/note-person-act.service';
import { NotePullRequestClosed } from '@outcomes/application/services/note-pull-request-closed.service';
import { NotePullRequestOpened } from '@outcomes/application/services/note-pull-request-opened.service';
import { NoteRunEnded } from '@outcomes/application/services/note-run-ended.service';
import { NoteRunSuperseded } from '@outcomes/application/services/note-run-superseded.service';
import { RecordJudgeScore } from '@outcomes/application/services/record-judge-score.service';
import { RunJudged } from '@outcomes/domain/events/run-judged.event';
import {
  askedJudging,
  JudgingsInMemory,
  judgeScore,
  RUBRIC_VERSION,
  reasonOf,
  ScoresInMemory,
} from '@outcomes/domain/judging.fake-spec';
import {
  FIRST_CONFIG,
  inTransaction,
  RunRecordsInMemory,
  TaskDeliveriesInMemory,
} from '@outcomes/domain/outcomes.fake-spec';
import { ScoreScale } from '@outcomes/domain/value-objects/score-scale.vo';
import { SeenEvidence } from '@outcomes/domain/value-objects/seen-evidence.vo';
import { outcomesSubscribers } from '@outcomes/presentation/events/outcomes.subscribers';
import { CHANGE_CHECKED } from '@shared-kernel/application/integration-events/change-checked.integration-event';
import { PULL_REQUEST_CLOSED } from '@shared-kernel/application/integration-events/pull-request-closed.integration-event';
import { PULL_REQUEST_OPENED } from '@shared-kernel/application/integration-events/pull-request-opened.integration-event';
import { RUN_ENDED } from '@shared-kernel/application/integration-events/run-ended.integration-event';
import { RUN_SUPERSEDED } from '@shared-kernel/application/integration-events/run-superseded.integration-event';
import { TASK_ACTED_ON } from '@shared-kernel/application/integration-events/task-acted-on.integration-event';
import { TASK_DELETED } from '@shared-kernel/application/integration-events/task-deleted.integration-event';
import { TEAM_DISBANDED } from '@shared-kernel/application/integration-events/team-disbanded.integration-event';
import { WORKSPACE_CLOSED } from '@shared-kernel/application/integration-events/workspace-closed.integration-event';
import { RunId } from '@shared-kernel/domain/value-objects/run-id.vo';
import { TaskId } from '@shared-kernel/domain/value-objects/task-id.vo';
import { describe, expect, it } from 'vitest';

const PULL = 'https://github.com/acme/api/pull/3';

const ENDED: EndedRun = {
  runId: 'run_1',
  workspaceId: 'ws_1',
  teamId: 'team_1',
  lineId: 'line_1',
  stationId: 'station_1',
  taskId: 'task_1',
  fingerprint: FIRST_CONFIG,
  round: 1,
  endedAt: new Date('2026-09-30T10:00:00.000Z'),
};

const WORK = {
  endedRun: async (runId: string) => (runId === ENDED.runId ? ENDED : null),
  costsOf: async () => new Map(),
  configsInOrder: async () => [],
};

const CLOCK = {
  now: () => new Date('2026-09-30T10:05:00.000Z'),
  sleep: async () => {},
};

const subscribed = () => {
  const records = new RunRecordsInMemory();
  const deliveries = new TaskDeliveriesInMemory();
  const judgings = new JudgingsInMemory();
  const scores = new ScoresInMemory();
  const asked: string[] = [];
  let next = 0;
  const subscribers = outcomesSubscribers({
    ending: new NoteRunEnded(WORK, records, inTransaction),
    superseding: new NoteRunSuperseded(records, inTransaction),
    checking: new NoteChangeChecked(records, inTransaction),
    acting: new NotePersonAct(records, inTransaction),
    opening: new NotePullRequestOpened(deliveries, inTransaction),
    closing: new NotePullRequestClosed(deliveries, inTransaction),
    forgetting: new ForgetOutcomes(
      records,
      deliveries,
      judgings,
      scores,
      inTransaction,
    ),
    judging: new AskForJudging(
      WORK,
      {
        holds: async () => true,
        of: async () => null,
        judgeAt: async () => ({
          teamId: 'team_1',
          lineId: 'line_1',
          rubric: 'Did the run retry uploads?',
          rubricVersion: RUBRIC_VERSION,
          sample: 1,
          trust: 0.6,
        }),
      },
      {
        available: true,
        model: 'some/model',
        judge: async () => ({ value: true, reasons: [] }),
      },
      judgings,
      inTransaction,
      CLOCK,
    ),
    scoring: new RecordJudgeScore(judgings, scores, inTransaction, {
      generate: () => {
        next += 1;
        return `score_${next}`;
      },
    }),
    grading: new GradeAsides({
      ask: async (taskId, runId) => {
        asked.push(`ask ${taskId.value} ${runId.value}`);
      },
      settle: async (taskId, runId) => {
        asked.push(`settle ${taskId.value} ${runId.value}`);
      },
    }),
  });

  const deliver = async (name: string, event: Record<string, unknown>) => {
    const subscriber = subscribers.find((each) => each.name === name);

    if (!subscriber) {
      throw new Error(`no subscriber ${name}`);
    }

    await subscriber.handle(event as never);
  };

  return {
    records,
    deliveries,
    judgings,
    scores,
    asked,
    subscribers,
    deliver,
    record: () => records.of(RunId.of('run_1')),
  };
};

const runEnded = (change: Record<string, unknown> = {}) => ({
  kind: RUN_ENDED,
  runId: 'run_1',
  workspaceId: 'ws_1',
  taskId: 'task_1',
  stationId: 'station_1',
  outcome: 'completed',
  failure: null,
  stopped: false,
  ...change,
});

describe('outcomesSubscribers', () => {
  it('names every subscriber within the context', () => {
    const { subscribers } = subscribed();

    expect(subscribers.every((each) => each.name.startsWith('outcomes.'))).toBe(
      true,
    );
    expect(new Set(subscribers.map((each) => each.name)).size).toBe(
      subscribers.length,
    );
  });

  it('records a run that ended at a station', async () => {
    const heard = subscribed();

    await heard.deliver('outcomes.record-ended-run', runEnded());

    expect((await heard.record())?.ending).toBe('completed');
  });

  it('records a run a person stopped as stopped', async () => {
    const heard = subscribed();

    await heard.deliver(
      'outcomes.record-ended-run',
      runEnded({ stopped: true }),
    );

    expect((await heard.record())?.ending).toBe('stopped');
  });

  it('records nothing for a run at no station', async () => {
    const heard = subscribed();

    await heard.deliver(
      'outcomes.record-ended-run',
      runEnded({ stationId: null }),
    );

    expect(await heard.record()).toBeNull();
  });

  it('fills in the checks, the next act and the superseding in any order', async () => {
    const heard = subscribed();

    await heard.deliver('outcomes.record-checked-change', {
      kind: CHANGE_CHECKED,
      runId: 'run_1',
      taskId: null,
      workspaceId: 'ws_1',
      passed: true,
    });
    await heard.deliver('outcomes.record-next-person-act', {
      kind: TASK_ACTED_ON,
      taskId: 'task_1',
      workspaceId: 'ws_1',
      stationId: 'station_1',
      act: 'sent-back',
      after: 'run_1',
      at: '2026-09-30T11:00:00.000Z',
    });
    await heard.deliver('outcomes.record-superseded-run', {
      kind: RUN_SUPERSEDED,
      runId: 'run_1',
      workspaceId: 'ws_1',
      taskId: 'task_1',
    });
    await heard.deliver('outcomes.record-ended-run', runEnded());

    const record = await heard.record();
    expect(record?.checks).toBe('passed');
    expect(record?.next?.act).toBe('sent-back');
    expect(record?.ending).toBe('superseded');
  });

  it('follows the task’s pull request from opened to merged', async () => {
    const heard = subscribed();

    await heard.deliver('outcomes.record-opened-pull-request', {
      kind: PULL_REQUEST_OPENED,
      taskId: 'task_1',
      workspaceId: 'ws_1',
      url: PULL,
    });
    await heard.deliver('outcomes.record-closed-pull-request', {
      kind: PULL_REQUEST_CLOSED,
      workspaceId: 'ws_1',
      pullRequest: PULL,
      repository: 'acme/api',
      closedAt: '2026-09-30T12:00:00.000Z',
      merged: true,
      mergeCommit: 'abc123',
    });

    expect((await heard.deliveries.forTask(TaskId.of('task_1')))?.state).toBe(
      'merged',
    );
  });

  it('forgets a deleted task’s runs and delivery', async () => {
    const heard = subscribed();
    await heard.deliver('outcomes.record-ended-run', runEnded());
    await heard.deliver('outcomes.record-opened-pull-request', {
      kind: PULL_REQUEST_OPENED,
      taskId: 'task_1',
      workspaceId: 'ws_1',
      url: PULL,
    });
    const deleted = {
      kind: TASK_DELETED,
      taskId: 'task_1',
      workspaceId: 'ws_1',
    };

    await heard.deliver('outcomes.forget-runs-of-deleted-task', deleted);
    await heard.deliver('outcomes.forget-delivery-of-deleted-task', deleted);

    expect(await heard.record()).toBeNull();
    expect(heard.deliveries.held.size).toBe(0);
  });

  it('forgets the runs of a disbanded team', async () => {
    const heard = subscribed();
    await heard.deliver('outcomes.record-ended-run', runEnded());

    await heard.deliver('outcomes.forget-runs-of-disbanded-team', {
      kind: TEAM_DISBANDED,
      workspaceId: 'ws_1',
      teamId: 'team_1',
      key: 'core',
    });

    expect(await heard.record()).toBeNull();
  });

  it('forgets everything of a closed workspace', async () => {
    const heard = subscribed();
    await heard.deliver('outcomes.record-ended-run', runEnded());
    await heard.deliver('outcomes.record-opened-pull-request', {
      kind: PULL_REQUEST_OPENED,
      taskId: 'task_1',
      workspaceId: 'ws_1',
      url: PULL,
    });
    const closed = {
      kind: WORKSPACE_CLOSED,
      workspaceId: 'ws_1',
      slug: 'acme',
    };

    await heard.deliver('outcomes.forget-runs-of-closed-workspace', closed);
    await heard.deliver(
      'outcomes.forget-deliveries-of-closed-workspace',
      closed,
    );

    expect(heard.records.held.size).toBe(0);
    expect(heard.deliveries.held.size).toBe(0);
  });

  it('asks for a judge’s verdict on a run that ended at a judged station', async () => {
    const heard = subscribed();

    await heard.deliver('outcomes.judge-ended-run', runEnded());
    await heard.deliver('outcomes.judge-ended-run', runEnded());

    const judging = await heard.judgings.of(RunId.of('run_1'));
    expect(judging?.owesWork).toBe(true);
    expect(judging?.rubric.version).toBe(RUBRIC_VERSION);
    expect(heard.judgings.held.size).toBe(1);
  });

  it('judges neither a withdrawn run nor one at no station', async () => {
    const heard = subscribed();

    await heard.deliver(
      'outcomes.judge-ended-run',
      runEnded({ outcome: 'withdrawn' }),
    );
    await heard.deliver(
      'outcomes.judge-ended-run',
      runEnded({ stationId: null }),
    );

    expect(heard.judgings.held.size).toBe(0);
  });

  it('records the judge’s score once, however often the verdict is heard', async () => {
    const heard = subscribed();
    const judged = new RunJudged(
      RunId.of('run_1'),
      askedJudging().workspaceId,
      askedJudging().place,
      null,
      RUBRIC_VERSION,
      ScoreScale.yesNo(),
      1,
      'some/model',
      [reasonOf()],
      SeenEvidence.none(),
      new Date('2026-09-30T10:05:00.000Z'),
    );

    await heard.deliver('outcomes.judge-ended-run', runEnded());
    await heard.deliver('outcomes.record-judge-score', judged as never);
    await heard.deliver('outcomes.record-judge-score', judged as never);

    const [score, ...rest] = [...heard.scores.held.values()];
    expect(rest).toEqual([]);
    expect(score?.source).toBe('judge');
    expect(score?.value).toBe(1);
  });

  it('records no score for a verdict heard after its task was deleted', async () => {
    const heard = subscribed();
    await heard.deliver('outcomes.judge-ended-run', runEnded());
    await heard.deliver('outcomes.forget-judgings-and-scores-of-deleted-task', {
      kind: TASK_DELETED,
      taskId: 'task_1',
      workspaceId: 'ws_1',
    });

    await heard.deliver(
      'outcomes.record-judge-score',
      new RunJudged(
        RunId.of('run_1'),
        askedJudging().workspaceId,
        askedJudging().place,
        null,
        RUBRIC_VERSION,
        ScoreScale.yesNo(),
        1,
        'some/model',
        [reasonOf()],
        SeenEvidence.none(),
        new Date('2026-09-30T10:05:00.000Z'),
      ) as never,
    );

    expect(heard.scores.held.size).toBe(0);
  });

  it('settles a run’s grade aside once a person grades it', async () => {
    const heard = subscribed();

    await heard.deliver('outcomes.ask-or-settle-grade', {
      kind: 'score.recorded',
      scoreId: 'score_1',
      runId: RunId.of('run_1'),
      place: askedJudging().place,
      source: 'person',
    } as never);

    expect(heard.asked).toEqual(['settle task_1 run_1']);
  });

  it('forgets a deleted task’s judgings and scores together', async () => {
    const heard = subscribed();
    await heard.deliver('outcomes.judge-ended-run', runEnded());
    await heard.scores.add(
      judgeScore('run_1', ScoreScale.yesNo(), 1, { taskId: 'task_1' }),
    );

    await heard.deliver('outcomes.forget-judgings-and-scores-of-deleted-task', {
      kind: TASK_DELETED,
      taskId: 'task_1',
      workspaceId: 'ws_1',
    });

    expect(heard.judgings.held.size).toBe(0);
    expect(heard.scores.held.size).toBe(0);
  });
});
