import { describe, expect, it } from 'vitest';

import {
  answerInboxItem,
  answerJudgeDisagreement,
  answerJudgeDisagreementClaim,
  approveMemories,
  deleteReviewComment,
  disputeDecision,
  draftReviewComment,
  editReviewComment,
  listInbox,
  listTaskJournalRuns,
  listTaskNotes,
  listTasks,
  markInboxItemRead,
  markInboxRequestRead,
  readInboxItem,
  readJudgeDisagreement,
  readMemoryReview,
  readTaskReview,
  readRunScores,
  readStationAlert,
  readTaskDecisions,
  readTaskJournal,
  rejectMemory,
  resolveInboxNotice,
  submitReview,
} from '@/lib/api';
import { client } from '@/lib/api/client.gen';
import { entryOf } from '@/mocks/entry';
import { serveMockApi } from '@/mocks/testing';
import { GROWTH_ID, PLATFORM_ID, SLUG } from '@/mocks/world';
import {
  ALERT_ID,
  ALERT_REQUEST_ID,
  CLAIMS_CHANGED_DISAGREEMENT_ID,
  COST_ALERT_ID,
  COST_ALERT_REQUEST_ID,
  DECIDED_MEMORIES_REQUEST_ID,
  LABEL_GONE_DISAGREEMENT_ID,
  MEMORIES_REQUEST_ID,
  MERGED_DISAGREEMENT_ID,
  MERGED_DISAGREEMENT_REQUEST_ID,
  SEARCH_DISAGREEMENT_ID,
  SEARCH_DISAGREEMENT_REQUEST_ID,
  SENT_BACK_DISAGREEMENT_ID,
  SETUP_ITEM_ID,
  STALLED_NOTICE_ID,
  VERDICTS_AGREE_DISAGREEMENT_ID,
  VERDICTS_AGREE_DISAGREEMENT_REQUEST_ID,
} from '@/mocks/world/inbox';
import { inboxStore } from '@/mocks/world/inbox-store';
import { TOM } from '@/mocks/world/people';

const detailOf = (error: unknown): unknown =>
  typeof error === 'object' && error !== null && 'detail' in error
    ? error.detail
    : undefined;

const inbox = async () => [
  ...(await listInbox({ path: { slug: SLUG }, throwOnError: true })).data.items,
  ...(
    await listInbox({
      path: { slug: SLUG },
      query: { state: 'resolved', limit: 200 },
      throwOnError: true,
    })
  ).data.items,
];

const itemIn = async (id: string) =>
  (await readInboxItem({ path: { slug: SLUG, itemId: id } })).data;

const RETRIES = {
  teamId: PLATFORM_ID,
  taskId: 'task_retries',
  runId: 'run_retries_2',
};

const POSTGRES_RUN = { teamId: PLATFORM_ID, runId: 'run_postgres_2' };
const POSTGRES_TASK = { teamId: PLATFORM_ID, taskId: 'task_postgres' };

const foldedNotesOf = async (
  item: NonNullable<Awaited<ReturnType<typeof itemIn>>>,
) =>
  (
    await Promise.all(
      item.folded.map(
        async (visit) =>
          (
            await listTaskNotes({
              path: { teamId: item.teamId, taskId: item.taskId },
              query: { from: visit.first.position, to: visit.to },
              throwOnError: true,
            })
          ).data,
      ),
    )
  ).flat();

const approvalIn = async (itemId: string) => {
  const item = await itemIn(itemId);

  return [
    ...(item ? await foldedNotesOf(item) : []),
    ...(item?.notes ?? []),
  ].findLast((note) => note.approval)?.approval;
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
      tasks.items.find((task) => task.id === 'task_rate_limits')
        ?.awaitingReview,
    ).toBeNull();
  });

  it('grants a tool call with the inputs a person changed', async () => {
    await answerInboxItem({
      path: { slug: SLUG, itemId: 'task_latency:0' },
      body: {
        body: '',
        approve: true,
        ask: 0,
        inputs: [{ name: 'for', value: '20m' }],
      },
      throwOnError: true,
    });

    const approval = (await itemIn('task_latency:0'))?.notes[0]?.approval;

    expect(approval?.status).toBe('approved');
    expect(approval?.edited).toEqual([{ name: 'for', value: '20m' }]);
  });

  it('refuses a decision that does not name the ask it decides, or names an older one', async () => {
    const decide = (ask?: number) =>
      answerInboxItem({
        path: { slug: SLUG, itemId: 'task_latency:0' },
        body: {
          body: '',
          approve: true,
          ...(ask === undefined ? {} : { ask }),
        },
      });

    expect((await decide()).response?.status).toBe(400);
    expect((await decide(1)).response?.status).toBe(409);
    expect((await itemIn('task_latency:0'))?.notes[0]?.approval?.status).toBe(
      'pending',
    );
  });

  it('requests approvals in every status', async () => {
    expect(await approvalIn('task_checkout:0')).toMatchObject({
      kind: 'harness-permission',
      status: 'pending',
      askedOf: null,
    });
    expect(await approvalIn('task_signup_survey:0')).toMatchObject({
      kind: 'tool-call',
      name: 'linear.comment',
      status: 'pending',
      askedOf: null,
    });
    expect(await approvalIn('task_pricing_toggle:0')).toMatchObject({
      status: 'pending',
      askedOf: { name: 'Priya Nair' },
    });
    expect(await approvalIn('task_disk:0')).toMatchObject({
      kind: 'harness-permission',
      status: 'dismissed',
    });

    const edited = await approvalIn('task_referral:0');

    expect(edited?.status).toBe('approved');
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
    await markInboxItemRead({
      path: { slug: SLUG, itemId: 'task_rate_limits:0' },
      throwOnError: true,
    });
    await markInboxRequestRead({
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

  it('lists a task’s journalled runs oldest first and reads one run’s journal', async () => {
    const { data: runs } = await listTaskJournalRuns({
      path: { slug: SLUG, taskId: 'task_postgres' },
      throwOnError: true,
    });
    const { data } = await readTaskJournal({
      path: { slug: SLUG, taskId: 'task_postgres', runId: 'run_postgres_2' },
      throwOnError: true,
    });

    expect(runs.map((run) => run.runId)).toEqual([
      'run_postgres_1',
      'run_postgres_2',
      'run_postgres_review',
      'run_postgres_fix',
      'run_postgres_3',
    ]);
    expect(data.map((journal) => journal.runId)).toEqual(['run_postgres_2']);
    expect(data[0]?.steps.some((step) => step.change)).toBe(true);
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

  it('shows what people said of a run beside the judge’s verdict, and whether they agree', async () => {
    const { data: merged } = await readRunScores({
      path: { teamId: PLATFORM_ID, runId: 'run_search_2' },
      throwOnError: true,
    });
    expect(merged).toMatchObject({ labelFrom: 'merged', agrees: false });
    expect(merged.judge?.passes).toBe(false);
    expect(merged.judge?.claims).toHaveLength(
      merged.judge?.claimResults.length ?? 0,
    );

    const { data: unlabelled } = await readRunScores({
      path: POSTGRES_RUN,
      throwOnError: true,
    });
    expect(unlabelled).toMatchObject({ labelFrom: null, agrees: null });
    expect(unlabelled.judge?.passes).toBe(true);
  });

  it('asks the team about a merged run the judge failed, about the claims in dispute', async () => {
    const asked = await itemIn(SEARCH_DISAGREEMENT_REQUEST_ID);
    expect(asked?.inboxRequest).toEqual({
      form: 'judge-disagreement',
      about: SEARCH_DISAGREEMENT_ID,
    });

    const { data: disagreement } = await readJudgeDisagreement({
      path: { teamId: PLATFORM_ID, disagreementId: SEARCH_DISAGREEMENT_ID },
      throwOnError: true,
    });
    expect(disagreement).toMatchObject({
      runId: 'run_search_2',
      direction: 'judge-failed',
      labelFrom: 'merged',
      askedOf: null,
      disputedClaims: [2],
      answers: [],
      notMet: null,
    });
    expect(disagreement.claims[1]?.reasons[0]?.citations[0]).toMatchObject({
      kind: 'step',
      hunk: null,
    });
    const elsewhere = await readJudgeDisagreement({
      path: { teamId: GROWTH_ID, disagreementId: SEARCH_DISAGREEMENT_ID },
    });
    expect(elsewhere.response?.status).toBe(404);
    expect(JSON.stringify(elsewhere.error)).toContain(
      `Judge disagreement ${SEARCH_DISAGREEMENT_ID} not found.`,
    );
  });

  it('takes one answer per claim in dispute, and resolves the question with the last one', async () => {
    const path = {
      teamId: PLATFORM_ID,
      disagreementId: MERGED_DISAGREEMENT_ID,
    };
    const { data: asked } = await readJudgeDisagreement({
      path,
      throwOnError: true,
    });
    const first = asked.disputedClaims.at(0);
    const second = asked.disputedClaims.at(1);
    expect(second).toBeDefined();
    const notDisputed = asked.claims.findIndex(
      (_, claim) => !asked.disputedClaims.includes(claim),
    );

    expect(
      await statusOf(
        answerJudgeDisagreementClaim({
          path: { ...path, claim: notDisputed },
          body: { answer: 'judge-right', note: null },
        }),
      ),
    ).toBe(422);
    expect(
      await statusOf(
        answerJudgeDisagreement({
          path,
          body: { note: 'It never ran the tests.', shouldHaveFailed: null },
        }),
      ),
    ).toBe(422);

    const { data: part } = await answerJudgeDisagreementClaim({
      path: { ...path, claim: first ?? 0 },
      body: { answer: 'judge-right', note: 'The lint step must pass.' },
      throwOnError: true,
    });
    expect(part).toMatchObject({
      state: 'open',
      answers: [
        {
          claim: first,
          answer: 'judge-right',
          note: 'The lint step must pass.',
        },
      ],
    });
    expect((await itemIn(MERGED_DISAGREEMENT_REQUEST_ID))?.resolved).toBe(
      false,
    );
    expect(
      await statusOf(
        answerJudgeDisagreementClaim({
          path: { ...path, claim: first ?? 0 },
          body: { answer: 'claim-wrong', note: null },
        }),
      ),
    ).toBe(409);

    const { data: whole } = await answerJudgeDisagreementClaim({
      path: { ...path, claim: second ?? 0 },
      body: { answer: 'claim-wrong', note: null },
      throwOnError: true,
    });
    expect(whole.state).toBe('answered');
    expect(whole.answers.map(({ claim }) => claim)).toEqual([first, second]);
    expect((await itemIn(MERGED_DISAGREEMENT_REQUEST_ID))?.resolved).toBe(true);
  });

  it('refuses an answer to a disagreement Spotlight withdrew, whose question is resolved', async () => {
    const path = {
      teamId: PLATFORM_ID,
      disagreementId: VERDICTS_AGREE_DISAGREEMENT_ID,
    };
    const { data } = await readJudgeDisagreement({ path, throwOnError: true });

    expect(data.withdrawnAt).not.toBeNull();
    expect(
      (await itemIn(VERDICTS_AGREE_DISAGREEMENT_REQUEST_ID))?.resolved,
    ).toBe(true);
    const refused = await answerJudgeDisagreementClaim({
      path: { ...path, claim: data.disputedClaims[0] ?? 0 },
      body: { answer: 'judge-right', note: null },
    });
    expect(refused.response?.status).toBe(409);
    expect(JSON.stringify(refused.error)).toContain('is withdrawn');
  });

  it('asks which claim a sent-back run did not meet, and what was wrong where no claim covers it', async () => {
    const path = {
      teamId: PLATFORM_ID,
      disagreementId: SENT_BACK_DISAGREEMENT_ID,
    };

    expect(
      await statusOf(
        answerJudgeDisagreement({
          path,
          body: { note: ' ', shouldHaveFailed: null },
        }),
      ),
    ).toBe(422);
    const { data } = await answerJudgeDisagreement({
      path,
      body: { note: null, shouldHaveFailed: 1 },
      throwOnError: true,
    });
    expect(data).toMatchObject({
      state: 'answered',
      notMet: { claim: 1, note: null },
    });
    expect(
      await statusOf(
        answerJudgeDisagreement({
          path,
          body: { note: null, shouldHaveFailed: 0 },
        }),
      ),
    ).toBe(409);
  });

  it('refuses what the server refuses, in the server’s words', async () => {
    const refusal = async (
      call: Promise<{ response?: Response; error?: unknown }>,
    ) => {
      const { response, error } = await call;
      return {
        status: response?.status,
        detail: detailOf(error),
      };
    };
    const longNote = 'x'.repeat(2_001);
    const noteTooLong = {
      status: 422,
      detail: 'A judge disagreement note must be at most 2000 characters.',
    };
    const sentBack = {
      teamId: PLATFORM_ID,
      disagreementId: SENT_BACK_DISAGREEMENT_ID,
    };
    const search = {
      teamId: PLATFORM_ID,
      disagreementId: SEARCH_DISAGREEMENT_ID,
    };
    const { data: asked } = await readJudgeDisagreement({
      path: sentBack,
      throwOnError: true,
    });

    expect(
      await refusal(
        answerJudgeDisagreement({
          path: sentBack,
          body: { note: longNote, shouldHaveFailed: 0 },
        }),
      ),
    ).toEqual(noteTooLong);
    expect(
      await refusal(
        answerJudgeDisagreement({
          path: sentBack,
          body: { note: null, shouldHaveFailed: asked.claims.length },
        }),
      ),
    ).toEqual({
      status: 422,
      detail:
        'A judge disagreement must name a claim of the judge that looked at the run.',
    });
    expect(
      await refusal(
        answerJudgeDisagreement({
          path: search,
          body: { note: 'It never ran the tests.', shouldHaveFailed: null },
        }),
      ),
    ).toEqual({
      status: 422,
      detail:
        'A judge disagreement takes what was not met only where the judge passed the run.',
    });
    expect(
      await refusal(
        answerJudgeDisagreementClaim({
          path: { ...search, claim: 2 },
          body: { answer: 'judge-right', note: longNote },
        }),
      ),
    ).toEqual(noteTooLong);
    expect(
      await refusal(
        answerJudgeDisagreement({
          path: sentBack,
          body: { note: null, shouldHaveFailed: -1 },
        }),
      ),
    ).toEqual({
      status: 422,
      detail:
        'A judge disagreement must name the claim that should have failed by its place, from 0.',
    });
    expect(
      await refusal(
        answerJudgeDisagreementClaim({
          path: { ...search, claim: 1.5 },
          body: { answer: 'judge-right', note: null },
        }),
      ),
    ).toEqual({
      status: 400,
      detail: 'Validation failed (numeric string is expected)',
    });
    expect(
      await refusal(
        client.post({
          url: '/teams/{teamId}/judge-disagreements/{disagreementId}/claims/{claim}/answer',
          path: {
            teamId: PLATFORM_ID,
            disagreementId: VERDICTS_AGREE_DISAGREEMENT_ID,
            claim: 0,
          },
          body: { answer: 'nope', note: null },
          headers: { 'Content-Type': 'application/json' },
        }),
      ),
    ).toEqual({
      status: 422,
      detail:
        'A judge disagreement must answer a claim with judge-right or claim-wrong.',
    });
  });

  it('refuses an answer from anyone but the person a question asks', async () => {
    const disagreement = entryOf(
      inboxStore().disagreements,
      SENT_BACK_DISAGREEMENT_ID,
    );
    expect(disagreement).toBeDefined();
    if (disagreement) {
      disagreement.askedOf = TOM.id;
    }

    const refused = await answerJudgeDisagreement({
      path: { teamId: PLATFORM_ID, disagreementId: SENT_BACK_DISAGREEMENT_ID },
      body: { note: null, shouldHaveFailed: 0 },
    });

    expect(refused.response?.status).toBe(403);
    expect(detailOf(refused.error)).toBe(
      `Judge disagreement ${SENT_BACK_DISAGREEMENT_ID} asks another person. Only that person can answer it.`,
    );
  });

  it('withdraws questions with a reason', async () => {
    const reasons = await Promise.all(
      [
        VERDICTS_AGREE_DISAGREEMENT_ID,
        CLAIMS_CHANGED_DISAGREEMENT_ID,
        LABEL_GONE_DISAGREEMENT_ID,
      ].map(
        async (disagreementId) =>
          (
            await readJudgeDisagreement({
              path: { teamId: PLATFORM_ID, disagreementId },
              throwOnError: true,
            })
          ).data.withdrawnBecause,
      ),
    );

    expect(reasons).toEqual(['verdicts-agree', 'claims-changed', 'label-gone']);
  });

  it('withdraws a question only once the run’s label or the claims moved on', async () => {
    const disagreementOf = async (disagreementId: string) =>
      (
        await readJudgeDisagreement({
          path: { teamId: PLATFORM_ID, disagreementId },
          throwOnError: true,
        })
      ).data;
    const scoresOf = async (runId: string) =>
      (
        await readRunScores({
          path: { teamId: PLATFORM_ID, runId },
          throwOnError: true,
        })
      ).data;

    const agreed = await disagreementOf(VERDICTS_AGREE_DISAGREEMENT_ID);
    expect(agreed).toMatchObject({
      labelFrom: 'merged',
      direction: 'judge-failed',
      askedOf: null,
    });
    expect(await scoresOf(agreed.runId)).toMatchObject({
      labelFrom: 'sent-back',
      agrees: true,
    });

    const gone = await disagreementOf(LABEL_GONE_DISAGREEMENT_ID);
    expect(gone).toMatchObject({ labelFrom: 'merged', askedOf: null });
    expect(await scoresOf(gone.runId)).toMatchObject({
      labelFrom: null,
      agrees: null,
    });

    const changed = await disagreementOf(CLAIMS_CHANGED_DISAGREEMENT_ID);
    const changedScores = await scoresOf(changed.runId);
    expect(changedScores).toMatchObject({ judged: true, judge: null });
    expect(changed.rubricVersion).not.toBe(
      (await scoresOf(agreed.runId)).judge?.rubricVersion,
    );
    expect(changed.claims.map(({ text }) => text)).not.toEqual(
      agreed.claims.map(({ text }) => text),
    );

    for (const withdrawn of [agreed, gone, changed]) {
      expect(
        withdrawn.withdrawnAt !== null &&
          withdrawn.withdrawnAt !== '' &&
          withdrawn.withdrawnAt > withdrawn.openedAt,
      ).toBe(true);
    }
  });

  it('drafts, edits, deletes and submits review comments', async () => {
    const { data: drafted } = await draftReviewComment({
      path: POSTGRES_TASK,
      body: { body: 'Batch it.', replyTo: 'comment_batching' },
      throwOnError: true,
    });
    await editReviewComment({
      path: { ...POSTGRES_TASK, commentId: drafted.id },
      body: { body: 'Batch it, 50k a time.' },
      throwOnError: true,
    });
    await deleteReviewComment({
      path: { ...POSTGRES_TASK, commentId: 'comment_pool_timeout' },
      throwOnError: true,
    });
    await submitReview({
      path: POSTGRES_TASK,
      body: { verdict: 'request-changes', body: 'Run the rewrite in batches.' },
      throwOnError: true,
    });

    const { data } = await readTaskReview({
      path: POSTGRES_TASK,
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
    const { data: journal } = await listTaskJournalRuns({
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
          listTaskJournalRuns({
            path: { slug: SLUG, taskId: 'task_postgres' },
          }),
        ),
        statusOf(
          readStationAlert({
            path: { teamId: PLATFORM_ID, alertId: ALERT_ID },
          }),
        ),
        statusOf(readRunScores({ path: POSTGRES_RUN })),
        statusOf(readTaskReview({ path: POSTGRES_TASK })),
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
