import { describe, expect, it } from 'vitest';
import {
  listInbox,
  listInsightsPullRequests,
  listInsightsRuns,
  listRunChangeStacks,
  listStationOutcomes,
  listTaskRuns,
  listTeamRuns,
  readInsightsStations,
  readRunConversation,
  readRunMemories,
  readRunReview,
  readRunScores,
  readStationAlert,
  readTaskDecisions,
  readTaskJournal,
  readTaskTrace,
} from '@/lib/api';
import { serveMockApi } from '@/mocks/testing';
import { DELIVERY_ID, PLATFORM_ID, SLUG } from '@/mocks/world';
import { ALERT_ID } from '@/mocks/world/inbox';
import { FINGERPRINTS } from '@/mocks/world/station-history';

const teamId = PLATFORM_ID;
const IMPLEMENTATION = 'station_implementation';

const within = (at: string, from: string, to: string) =>
  Date.parse(at) >= Date.parse(from) && Date.parse(at) < Date.parse(to);

const teamRuns = async () =>
  (await listTeamRuns({ path: { teamId }, throwOnError: true })).data;

const journalOf = async (taskId: string) =>
  (await readTaskJournal({ path: { slug: SLUG, taskId }, throwOnError: true }))
    .data;

const newSideHolds = (patch: string, line: number): boolean => {
  const [header = ''] = patch.split('\n');
  const [, start = '0', length = '0'] =
    header.match(/\+(\d+),(\d+)/) ?? ([] as string[]);

  return line >= Number(start) && line < Number(start) + Number(length);
};

describe('one run history across the mock', () => {
  serveMockApi();

  it('counts the same Implementation runs on the station page as Insights does over 30 days', async () => {
    const { data: insights } = await readInsightsStations({
      path: { teamId },
      query: { period: '30d' },
      throwOnError: true,
    });
    const { data: outcomes } = await listStationOutcomes({
      path: { teamId, lineId: DELIVERY_ID, stationId: IMPLEMENTATION },
      query: { last: 200 },
      throwOnError: true,
    });
    const { from, to } = insights.period;
    const onStation = outcomes.groups
      .flatMap((group) => group.runs)
      .filter((run) => within(run.endedAt, from, to));
    const counted = insights.stations.find(
      (each) => each.stationId === IMPLEMENTATION,
    )?.tally;

    expect(onStation.length).toBeGreaterThan(20);
    expect(onStation.length).toBe(counted?.runs);
    expect(onStation.filter((run) => run.ending === 'failed').length).toBe(
      counted?.failed,
    );
  });

  it('groups station runs under the config versions Insights knows', async () => {
    const { data } = await listStationOutcomes({
      path: { teamId, lineId: DELIVERY_ID, stationId: IMPLEMENTATION },
      query: { last: 200 },
      throwOnError: true,
    });

    expect(data.groups.map((group) => group.fingerprint)).toEqual([
      FINGERPRINTS.tests,
      FINGERPRINTS.effort,
      FINGERPRINTS.judge,
      FINGERPRINTS.first,
    ]);
  });

  it('lists every run Insights counts in the team runs list', async () => {
    const runs = new Set((await teamRuns()).map((run) => run.id));
    const { data } = await listInsightsRuns({
      path: { teamId },
      query: { period: '90d', size: 500 },
      throwOnError: true,
    });

    expect(data.runs.length).toBeGreaterThan(100);
    expect(data.runs.every((run) => runs.has(run.runId))).toBe(true);
  });

  it('answers the conversation of every run in the team runs list', async () => {
    const runs = await teamRuns();
    const answers = await Promise.all(
      runs.map((run) =>
        readRunConversation({ path: { teamId, runId: run.id } }),
      ),
    );

    expect(runs.length).toBeGreaterThan(500);
    expect(answers.every((each) => each.response?.status === 200)).toBe(true);
    expect(answers.every((each) => each.data?.taskId)).toBe(true);
  });

  it('opens a past run like a core one: memories, changes, scores, review, trace, journal and runs', async () => {
    const runs = await teamRuns();
    const past = runs.filter((run) => !run.id.match(/^run_[a-z]+_\d$/));
    const sample = past.filter((_, at) => at % 40 === 0);

    for (const run of sample) {
      const path = { teamId, runId: run.id };
      const taskId = run.taskId ?? '';
      const [memories, stacks, scores, review, trace, journal, ofTask] =
        await Promise.all([
          readRunMemories({ path }),
          listRunChangeStacks({ path }),
          readRunScores({ path }),
          readRunReview({ path }),
          readTaskTrace({ path: { teamId, taskId } }),
          readTaskJournal({ path: { slug: SLUG, taskId } }),
          listTaskRuns({ path: { teamId, taskId } }),
        ]);

      expect(
        [memories, stacks, scores, review, trace, journal, ofTask].map(
          (each) => each.response?.status,
        ),
      ).toEqual([200, 200, 200, 200, 200, 200, 200]);
      expect(trace.data?.roots.map((root) => root.id)).toContain(
        `run:${run.id}`,
      );
      expect(journal.data?.map((each) => each.runId)).toContain(run.id);
      expect(ofTask.data?.map((each) => each.id)).toContain(run.id);
    }
  });

  it('briefs a run only with memories approved before it started', async () => {
    const runs = (await teamRuns()).filter(
      (run, at) => run.id.match(/^run_[a-z]+_\d$/) || at % 60 === 0,
    );

    for (const run of runs) {
      const { data } = await readRunMemories({
        path: { teamId, runId: run.id },
        throwOnError: true,
      });

      expect(
        data.briefed.every((memory) => memory.approvedAt <= run.startedAt),
        run.id,
      ).toBe(true);
    }
  });

  it('opens the task of every merged pull request Insights lists', async () => {
    const { data } = await listInsightsPullRequests({
      path: { teamId },
      query: { period: '30d' },
      throwOnError: true,
    });
    const tasks = data.pullRequests.flatMap((each) =>
      each.taskId ? [each.taskId] : [],
    );
    const answers = await Promise.all(
      tasks.map((taskId) => listTaskRuns({ path: { teamId, taskId } })),
    );

    expect(tasks.length).toBeGreaterThan(0);
    expect(answers.every((each) => (each.data?.length ?? 0) > 0)).toBe(true);
  });

  it('draws the alert series from runs that exist', async () => {
    const { data: alert } = await readStationAlert({
      path: { teamId, alertId: ALERT_ID },
      throwOnError: true,
    });
    const runs = new Set((await teamRuns()).map((run) => run.id));

    expect(alert.series.every((point) => runs.has(point.runId))).toBe(true);
    expect(alert.change?.by).toBeGreaterThanOrEqual(0.2);
  });
});

describe('the Postgres upgrade reads the same everywhere', () => {
  serveMockApi();

  it('anchors every review comment to a line in the run’s change stack', async () => {
    const path = { teamId, runId: 'run_postgres_2' };
    const { data: review } = await readRunReview({ path, throwOnError: true });
    const { data: changes } = await listRunChangeStacks({
      path,
      throwOnError: true,
    });
    const files = changes.stacks.flatMap((stack) => stack.files);

    expect(review.comments.length).toBeGreaterThan(0);
    for (const comment of review.comments) {
      const file = files.find((each) => each.path === comment.path);

      expect(file, comment.path).toBeDefined();
      expect(
        file?.hunks.some((hunk) => newSideHolds(hunk.patch, comment.line ?? 1)),
      ).toBe(true);
    }
  });

  it('points every decision at journal steps that touch its files', async () => {
    const { data: decisions } = await readTaskDecisions({
      path: { teamId, taskId: 'task_postgres' },
      throwOnError: true,
    });
    const steps =
      (await journalOf('task_postgres')).find(
        (journal) => journal.runId === decisions.runId,
      )?.steps ?? [];
    const { data: changes } = await listRunChangeStacks({
      path: { teamId, runId: decisions.runId ?? '' },
      throwOnError: true,
    });
    const changed = new Set(
      changes.stacks.flatMap((stack) => stack.files.map((each) => each.path)),
    );

    for (const decision of decisions.decisions) {
      expect(decision.paths.every((each) => changed.has(each))).toBe(true);
      expect(decision.steps.every((index) => steps[index] !== undefined)).toBe(
        true,
      );
    }
  });

  it('tells the same pull request size in the review step and the change stack', async () => {
    const reviewed = (await journalOf('task_postgres')).find(
      (journal) => journal.runId === 'run_postgres_3',
    );
    const { data: changes } = await listRunChangeStacks({
      path: { teamId, runId: 'run_postgres_2' },
      throwOnError: true,
    });
    const files = changes.stacks.flatMap((stack) => stack.files).length;

    expect(reviewed?.steps[0]?.detail).toContain(`${files} files changed`);
  });
});

describe('the task journal and the run conversations tell one story', () => {
  serveMockApi();

  it('shows the retry drain the same in the inbox, the journal and the run', async () => {
    const { data: inbox } = await listInbox({
      path: { slug: SLUG },
      throwOnError: true,
    });
    const item = inbox.find(
      (each) => each.kind === 'task' && each.id === 'task_retries:0',
    );
    const { data: run } = await readRunConversation({
      path: { teamId, runId: 'run_retries_2' },
      throwOnError: true,
    });
    const journal = (await journalOf('task_retries')).find(
      (each) => each.runId === 'run_retries_2',
    );
    const inboxNotes = item?.kind === 'task' ? item.notes : [];
    const answer = run.notes.find((note) => note.kind === 'answered');

    expect(
      inboxNotes.filter(
        (note) => note.runId === 'run_retries_2' || !note.runId,
      ),
    ).toEqual(
      expect.arrayContaining(
        run.notes.map((note) =>
          expect.objectContaining({ body: note.body, at: note.at }),
        ),
      ),
    );
    expect(answer?.author?.name).toBe('Maya Chen');
    expect(journal?.steps.map((step) => step.text)).toContain(
      'docs/specs/drain-retry-queues.md',
    );
    expect(inboxNotes.map((note) => note.body).join('\n')).toContain('1,204');
    expect(run.notes[0]?.body).toContain('RETRY_CONCURRENCY');
  });

  it('times the trace steps like the journal steps', async () => {
    const { data: trace } = await readTaskTrace({
      path: { teamId, taskId: 'task_postgres' },
      throwOnError: true,
    });
    const journal = await journalOf('task_postgres');
    const traced = trace.roots.flatMap((root) =>
      root.children.flatMap((child) =>
        child.children.flatMap((each) => (each.step ? [each.step] : [])),
      ),
    );

    expect(traced).toEqual(journal.flatMap((each) => each.steps));
  });

  it('prices a run the same in its conversation, its journal and Insights', async () => {
    const { data: run } = await readRunConversation({
      path: { teamId, runId: 'run_postgres_2' },
      throwOnError: true,
    });
    const journal = (await journalOf('task_postgres')).find(
      (each) => each.runId === 'run_postgres_2',
    );
    const { data: insights } = await listInsightsRuns({
      path: { teamId },
      query: { period: '30d', taskId: 'task_postgres', size: 10 },
      throwOnError: true,
    });

    expect(journal?.spent?.cost).toBe(run.spend?.cost);
    expect(
      insights.runs.find((each) => each.runId === 'run_postgres_2')?.cost
        ?.amount,
    ).toBe(run.spend?.cost);
  });
});
