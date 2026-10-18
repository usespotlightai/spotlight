import { describe, expect, it } from 'vitest';
import {
  answerInboxItem,
  approveMemories,
  deleteReviewComment,
  disputeDecision,
  draftReviewComment,
  editReviewComment,
  gradeRun,
  type InboxItemResponseDto,
  listInbox,
  listTasks,
  readInboxItem,
  readInboxRequest,
  readMemoryReview,
  readRunReview,
  readRunScores,
  readStationAlert,
  readTaskDecisions,
  readTaskJournal,
  rejectMemory,
  resolveInboxNotice,
  submitReview,
} from '@/lib/api';
import { serveMockApi } from '@/mocks/testing';
import { GROWTH_ID, PLATFORM_ID, SLUG } from '@/mocks/world';
import {
  ALERT_ID,
  ALERT_REQUEST_ID,
  CLAIMS_GRADE_REQUEST_ID,
  COST_ALERT_ID,
  COST_ALERT_REQUEST_ID,
  DECIDED_MEMORIES_REQUEST_ID,
  FIVE_POINT_GRADE_REQUEST_ID,
  GRADE_REQUEST_ID,
  MEMORIES_REQUEST_ID,
  SETUP_ITEM_ID,
  STALLED_NOTICE_ID,
} from '@/mocks/world/inbox';

const inbox = async () =>
  (await listInbox({ path: { slug: SLUG }, throwOnError: true })).data;

const itemIn = async (id: string) =>
  (await inbox()).find(
    (entry): entry is InboxItemResponseDto =>
      entry.kind === 'task' && entry.id === id,
  );

const RETRIES = {
  teamId: PLATFORM_ID,
  taskId: 'task_retries',
  runId: 'run_retries_2',
};

const POSTGRES_RUN = { teamId: PLATFORM_ID, runId: 'run_postgres_2' };

const approvalIn = async (itemId: string) =>
  (await itemIn(itemId))?.notes.findLast((note) => note.approval)?.approval;

const scoresAbout = async (requestId: string) => {
  const inboxRequest = await itemIn(requestId);
  const { data } = await readRunScores({
    path: {
      teamId: inboxRequest?.teamId ?? '',
      runId: inboxRequest?.inboxRequest?.about ?? '',
    },
    throwOnError: true,
  });

  return data;
};

describe('the mock inbox', () => {
  serveMockApi();

  it('contains open and resolved work across both teams', async () => {
    const entries = await inbox();
    const ids = entries.map((entry) => entry.id);

    expect(ids).toEqual(
      expect.arrayContaining([
        'task_rate_limits:0',
        'task_postgres:0',
        'task_onboarding_copy:0',
        MEMORIES_REQUEST_ID,
        ALERT_REQUEST_ID,
        STALLED_NOTICE_ID,
      ]),
    );
    expect(entries.some((entry) => entry.resolved)).toBe(true);
    expect(entries.some((entry) => entry.unread)).toBe(true);
    expect(new Set(entries.map((entry) => entry.teamId))).toEqual(
      new Set([PLATFORM_ID, GROWTH_ID]),
    );
  });

  it('answers a question, and its pending review is answered', async () => {
    await answerInboxItem({
      path: { slug: SLUG, itemId: 'task_rate_limits:0' },
      body: { body: 'Per API key.' },
      throwOnError: true,
    });

    const item = await itemIn('task_rate_limits:0');
    const { data: tasks } = await listTasks({
      path: { teamId: PLATFORM_ID },
      throwOnError: true,
    });

    expect(item?.resolved).toBe(true);
    expect(item?.notes.at(-1)).toMatchObject({
      kind: 'answered',
      body: 'Per API key.',
      author: { name: 'Sam Rivera' },
    });
    expect(
      tasks.find((task) => task.id === 'task_rate_limits')?.awaitingReview,
    ).toBeNull();
  });

  it('grants a tool call with the inputs a person changed', async () => {
    await answerInboxItem({
      path: { slug: SLUG, itemId: 'task_latency:0' },
      body: {
        body: '',
        approve: true,
        inputs: [{ name: 'for', value: '20m' }],
      },
      throwOnError: true,
    });

    const approval = (await itemIn('task_latency:0'))?.notes[0]?.approval;

    expect(approval?.status).toBe('granted');
    expect(approval?.edited).toEqual([{ name: 'for', value: '20m' }]);
  });

  it('requests approvals in every status', async () => {
    expect(await approvalIn('task_checkout:0')).toMatchObject({
      kind: 'harness-permission',
      status: 'asked',
      askedOf: null,
    });
    expect(await approvalIn('task_signup_survey:0')).toMatchObject({
      kind: 'tool-call',
      name: 'linear.comment',
      status: 'asked',
      askedOf: null,
    });
    expect(await approvalIn('task_pricing_toggle:0')).toMatchObject({
      status: 'asked',
      askedOf: { name: 'Priya Nair' },
    });
    expect(await approvalIn('task_disk:0')).toMatchObject({
      kind: 'harness-permission',
      status: 'refused',
    });

    const edited = await approvalIn('task_referral:0');

    expect(edited?.status).toBe('granted');
    expect(edited?.edited?.[1]?.value).not.toBe(edited?.inputs[1]?.value);
  });

  it('answers the team’s setup, long since done', async () => {
    expect(await itemIn(SETUP_ITEM_ID)).toMatchObject({
      title: 'Set up your team',
      resolved: true,
      notes: [expect.objectContaining({ form: 'setup' })],
    });
  });

  it('marks items and inbox requests read, and resolves notices', async () => {
    await readInboxItem({
      path: { slug: SLUG, itemId: 'task_rate_limits:0' },
      throwOnError: true,
    });
    await readInboxRequest({
      path: { slug: SLUG, requestId: MEMORIES_REQUEST_ID },
      throwOnError: true,
    });
    await resolveInboxNotice({
      path: { slug: SLUG, noticeId: STALLED_NOTICE_ID },
      throwOnError: true,
    });

    const entries = await inbox();
    const unreadOf = (id: string) =>
      entries.find((entry) => entry.id === id)?.unread;

    expect(unreadOf('task_rate_limits:0')).toBe(false);
    expect(unreadOf(MEMORIES_REQUEST_ID)).toBe(false);
    expect(
      entries.find((entry) => entry.id === STALLED_NOTICE_ID)?.resolved,
    ).toBe(true);
  });

  it('reads a task’s journal, its runs oldest first', async () => {
    const { data } = await readTaskJournal({
      path: { slug: SLUG, taskId: 'task_postgres' },
      throwOnError: true,
    });

    expect(data.map((journal) => journal.runId)).toEqual([
      'run_postgres_1',
      'run_postgres_2',
      'run_postgres_3',
    ]);
    expect(data[1]?.steps.some((step) => step.change)).toBe(true);
  });

  it('reads the alert that fired at the Implementation station', async () => {
    const { data } = await readStationAlert({
      path: { teamId: PLATFORM_ID, alertId: ALERT_ID },
      throwOnError: true,
    });

    expect(data.stationId).toBe('station_implementation');
    expect(data.rule).toMatchObject({
      measure: 'sent_back_rate',
      risesBy: 0.2,
      over: 20,
    });
    expect(data.series.at(-1)?.runId).toBe(data.runId);
  });

  it('fires a cost alert that is still active beside one that resolved', async () => {
    const { data: cost } = await readStationAlert({
      path: { teamId: PLATFORM_ID, alertId: COST_ALERT_ID },
      throwOnError: true,
    });
    const { data: sentBack } = await readStationAlert({
      path: { teamId: PLATFORM_ID, alertId: ALERT_ID },
      throwOnError: true,
    });

    expect(cost.rule).toMatchObject({ measure: 'cost_per_run', above: 2 });
    expect(cost.value).toBeGreaterThan(2);
    expect(cost.resolvedAt).toBeNull();
    expect((await itemIn(COST_ALERT_REQUEST_ID))?.resolved).toBe(false);
    expect(sentBack.resolvedAt).not.toBeNull();
    expect((await itemIn(ALERT_REQUEST_ID))?.resolved).toBe(true);
  });

  it('requests grades on every scale', async () => {
    const claims = await scoresAbout(CLAIMS_GRADE_REQUEST_ID);
    const five = await scoresAbout(FIVE_POINT_GRADE_REQUEST_ID);

    expect(claims).toMatchObject({
      kind: 'claims',
      stationId: 'station_design',
    });
    expect(claims.claims).toHaveLength(3);
    expect(five).toMatchObject({ kind: 'number', grades: [] });
    expect(five.judge?.kind).toBe('number');
  });

  it('grades a judged run and resolves the grade it asked for', async () => {
    const { data: before } = await readRunScores({
      path: POSTGRES_RUN,
      throwOnError: true,
    });
    const { data: after } = await gradeRun({
      path: POSTGRES_RUN,
      body: { value: true },
      throwOnError: true,
    });

    expect(before.judge?.label).toBe('yes');
    expect(after.grades[0]).toMatchObject({ mine: true, label: 'yes' });
    expect((await itemIn(GRADE_REQUEST_ID))?.resolved).toBe(true);
  });

  it('drafts, edits, deletes and submits review comments', async () => {
    const { data: drafted } = await draftReviewComment({
      path: POSTGRES_RUN,
      body: { body: 'Batch it.', replyTo: 'comment_batching' },
      throwOnError: true,
    });
    await editReviewComment({
      path: { ...POSTGRES_RUN, commentId: drafted.id },
      body: { body: 'Batch it, 50k a time.' },
      throwOnError: true,
    });
    await deleteReviewComment({
      path: { ...POSTGRES_RUN, commentId: 'comment_pool_timeout' },
      throwOnError: true,
    });
    await submitReview({
      path: POSTGRES_RUN,
      body: { verdict: 'request-changes', body: 'Run the rewrite in batches.' },
      throwOnError: true,
    });

    const { data } = await readRunReview({
      path: POSTGRES_RUN,
      throwOnError: true,
    });
    const mine = data.comments.find((each) => each.id === drafted.id);

    expect(mine).toMatchObject({
      body: 'Batch it, 50k a time.',
      replyTo: 'comment_batching',
      state: 'posted',
    });
    expect(
      data.comments.some((each) => each.id === 'comment_pool_timeout'),
    ).toBe(false);
    expect(data.reviews.at(-1)?.verdict).toBe('request-changes');
  });

  it('reads and disputes a task’s decisions', async () => {
    const { data: before } = await readTaskDecisions({
      path: { teamId: PLATFORM_ID, taskId: 'task_postgres' },
      throwOnError: true,
    });
    const { data: after } = await disputeDecision({
      path: {
        teamId: PLATFORM_ID,
        taskId: 'task_postgres',
        decisionId: 'decision_one_statement',
      },
      body: {
        path: 'migrations/0042_invoice_paid_at_precision.sql',
        reason: 'We agreed on batches.',
      },
      throwOnError: true,
    });

    expect(before.decisions[0]?.kind).toBe('deviation');
    expect(after.decisions[0]?.disputes).toEqual([
      expect.objectContaining({ byName: 'Sam Rivera' }),
    ]);
  });

  it('shows the memory of the run as approved, and resolves the inbox request once the last is decided', async () => {
    const { data: review } = await readMemoryReview({
      path: RETRIES,
      throwOnError: true,
    });

    expect(review.memories.map((memory) => memory.state)).toEqual([
      'approved',
      'approved',
      'proposed',
    ]);

    const { data: decided } = await rejectMemory({
      path: { ...RETRIES, memoryId: 'memory_redeploy_check' },
      throwOnError: true,
    });

    expect(decided.memories.map((memory) => memory.state)).toEqual([
      'approved',
      'approved',
      'rejected',
    ]);
    expect((await itemIn(MEMORIES_REQUEST_ID))?.resolved).toBe(true);
  });

  it('shows memories already decided', async () => {
    const { data } = await readMemoryReview({
      path: { teamId: PLATFORM_ID, taskId: 'task_disk', runId: 'run_disk_1' },
      throwOnError: true,
    });

    expect(data.memories.map((memory) => memory.state)).toEqual([
      'approved',
      'rejected',
    ]);
    expect((await itemIn(DECIDED_MEMORIES_REQUEST_ID))?.resolved).toBe(true);
  });

  it('approves a proposed memory', async () => {
    const { data: decided } = await approveMemories({
      path: RETRIES,
      body: { memories: [{ id: 'memory_redeploy_check' }] },
      throwOnError: true,
    });

    expect(decided.memories.map((memory) => memory.state)).toEqual([
      'approved',
      'approved',
      'approved',
    ]);
  });
});

const statusOf = async (call: Promise<{ response?: Response }>) =>
  (await call).response?.status;

describe('the mock inbox in an empty workspace', () => {
  serveMockApi('empty');

  it('contains only the open setup of the new team', async () => {
    const { data: journal } = await readTaskJournal({
      path: { slug: SLUG, taskId: 'task_setup_platform' },
      throwOnError: true,
    });

    expect((await inbox()).map((entry) => [entry.id, entry.resolved])).toEqual([
      [SETUP_ITEM_ID, false],
    ]);
    expect(journal).toEqual([]);
  });

  it('answers empty', async () => {
    expect(
      await Promise.all([
        statusOf(
          readTaskJournal({ path: { slug: SLUG, taskId: 'task_postgres' } }),
        ),
        statusOf(
          readStationAlert({
            path: { teamId: PLATFORM_ID, alertId: ALERT_ID },
          }),
        ),
        statusOf(readRunScores({ path: POSTGRES_RUN })),
        statusOf(readRunReview({ path: POSTGRES_RUN })),
        statusOf(
          readTaskDecisions({
            path: { teamId: PLATFORM_ID, taskId: 'task_postgres' },
          }),
        ),
        statusOf(readMemoryReview({ path: RETRIES })),
      ]),
    ).toEqual([404, 404, 404, 404, 404, 404]);
  });
});
