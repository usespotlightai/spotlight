import type { Judging } from '@insights/domain/aggregates/judging.aggregate';
import type { RunJudged } from '@insights/domain/events/run-judged.event';
import { InvalidJudgingError } from '@insights/domain/exceptions/invalid-judging.error';
import { JudgeEvidence } from '@insights/domain/services/judge-evidence';
import {
  NEXT_RUBRIC_VERSION,
  queuedJudging,
  rubricOf,
} from '@insights/judging.fake-spec';
import { JudgingFailure } from '@shared-kernel/domain/value-objects/judging-failure.vo';
import { WAIT_MS } from '@shared-kernel/domain/value-objects/pending-job.vo';
import { RunId } from '@shared-kernel/domain/value-objects/run-id.vo';
import { describe, expect, it } from 'vitest';

const NOW = new Date('2026-09-30T10:05:00.000Z');

const evidenceFor = (runId = 'run_1') =>
  JudgeEvidence.of({
    runId: RunId.of(runId),
    title: 'Retry uploads',
    description: null,
    steps: [
      {
        index: 4,
        kind: 'message',
        tool: null,
        text: 'Retrying in the request.',
        input: null,
        output: null,
      },
    ],
    hunks: [],
  });

const GROUNDED = [{ text: 'It retried.', steps: [4], hunks: [] }];

const oneClaim = () =>
  queuedJudging('run_1', rubricOf(undefined, ['It retries.']));

const judged = (judging: Judging, met: boolean, reasons = GROUNDED) =>
  judging.recordVerdict({
    verdict: { claims: [{ index: 0, met, reasons }] },
    evidence: evidenceFor(),
    model: 'some/model',
    now: NOW,
  });

describe('Judging', () => {
  it('has a pending job until it is judged', () => {
    const queued = oneClaim();

    expect(queued.hasPendingJob).toBe(true);
    expect(queued.pullEvents()).toEqual([]);
  });

  it('records the judge’s grounded verdict claim by claim', () => {
    const done = judged(oneClaim(), true);
    const [event] = done.pullEvents() as RunJudged[];

    expect(done.hasPendingJob).toBe(false);
    expect(done.judgedAt).toEqual(NOW);
    expect(event?.kind).toBe('judging.judged');
    expect(event?.claimResults).toEqual([true]);
    expect(event?.passThreshold).toBe(1);
    expect(event?.reasons).toHaveLength(1);
  });

  it('records each claim’s result with the rubric’s pass threshold', () => {
    const queued = queuedJudging(
      'run_1',
      rubricOf(undefined, ['It retries.', 'It adds a test.'], 0.5),
    );
    const done = queued.recordVerdict({
      verdict: {
        claims: [
          { index: 0, met: true, reasons: GROUNDED },
          { index: 1, met: false, reasons: GROUNDED },
        ],
      },
      evidence: evidenceFor(),
      model: 'some/model',
      now: NOW,
    });
    const [event] = done.pullEvents() as RunJudged[];

    expect(event?.passThreshold).toBe(0.5);
    expect(event?.claimResults).toEqual([true, false]);
    expect(event?.reasons.map((each) => each.claim)).toEqual([0, 1]);
  });

  it('retries later when every reason cites what is not there', () => {
    const done = judged(oneClaim(), true, [
      { text: 'Made up.', steps: [99], hunks: [] },
    ]);

    expect(done.hasPendingJob).toBe(true);
    expect(done.job?.nextAttemptAt?.getTime()).toBeGreaterThan(NOW.getTime());
    expect(done.pullEvents()).toEqual([]);
  });

  it('retries later unless most of its reasons cite what the judge read', () => {
    const half = judged(oneClaim(), true, [
      ...GROUNDED,
      { text: 'Made up.', steps: [99], hunks: [] },
    ]);
    const mostlyGrounded = judged(oneClaim(), true, [
      ...GROUNDED,
      ...GROUNDED,
      { text: 'Made up.', steps: [99], hunks: [] },
    ]);

    expect(half.hasPendingJob).toBe(true);
    expect(mostlyGrounded.hasPendingJob).toBe(false);
    expect((mostlyGrounded.pullEvents()[0] as RunJudged).reasons).toHaveLength(
      2,
    );
  });

  it('keeps what each cited step said, as the judge read it', () => {
    const event = judged(oneClaim(), true).pullEvents()[0] as RunJudged;
    const [citation] = event.reasons[0]?.citations ?? [];

    expect(event.seen.stepAt(citation?.step ?? -1)?.text).toBe(
      'Retrying in the request.',
    );
  });

  it('retries later when the verdict gives a claim more than three reasons', () => {
    const done = judged(
      oneClaim(),
      true,
      Array.from({ length: 4 }, () => GROUNDED[0]),
    );

    expect(done.hasPendingJob).toBe(true);
  });

  it('retries later when the verdict leaves out a claim', () => {
    const done = oneClaim().recordVerdict({
      verdict: { claims: [] },
      evidence: evidenceFor(),
      model: 'some/model',
      now: NOW,
    });

    expect(done.hasPendingJob).toBe(true);
    expect(done.pullEvents()).toEqual([]);
  });

  it('is judged only on its own run’s evidence', () => {
    expect(() =>
      oneClaim().recordVerdict({
        verdict: { claims: [{ index: 0, met: true, reasons: GROUNDED }] },
        evidence: evidenceFor('run_2'),
        model: 'some/model',
        now: NOW,
      }),
    ).toThrow(InvalidJudgingError);
  });

  it('fails where there is nothing to judge', () => {
    const done = oneClaim()
      .leaseJob(NOW)
      .failed(JudgingFailure.of('no-evidence', NOW));

    expect(done.hasPendingJob).toBe(false);
    expect(done.failure?.code).toBe('no-evidence');
  });

  it('is leased while it is worked on, and is dead-lettered once it keeps being interrupted', () => {
    let judging = oneClaim();

    for (let attempt = 0; attempt < 4; attempt += 1) {
      judging = judging.leaseJob(new Date(NOW.getTime() + attempt * 3_600_000));
    }

    expect(judging.jobExhausted).toBe(true);
    expect(judging.deadLetter(NOW).failure?.code).toBe('interrupted');
  });

  it('waits for its assist session without spending the attempt it leased', () => {
    const at = new Date(NOW.getTime() + 15_000);
    const waiting = oneClaim().leaseJob(NOW).waitJob(at);

    expect(waiting.hasPendingJob).toBe(true);
    expect(waiting.job?.attempts).toBe(0);
    expect(waiting.job?.nextAttemptAt).toEqual(
      new Date(at.getTime() + WAIT_MS),
    );
    expect(waiting.job?.waitingSince).toEqual(at);
    expect(judged(oneClaim(), true).waitJob(at).hasPendingJob).toBe(false);
  });

  it('ignores a verdict once it is done', () => {
    const done = judged(oneClaim(), true);
    done.pullEvents();

    expect(judged(done, false)).toBe(done);
  });

  it('is judged live unless it re-judges a run', () => {
    expect(oneClaim().origin).toBe('live');
  });

  it('re-judges a judged run with new claims as a backfill', () => {
    const done = judged(oneClaim(), true);
    done.pullEvents();
    const next = rubricOf(NEXT_RUBRIC_VERSION, ['It retries twice.']);

    const again = done.rejudged(next, NOW);
    const [event] = judged(again, false).pullEvents() as RunJudged[];

    expect(again.hasPendingJob).toBe(true);
    expect(again.origin).toBe('backfill');
    expect(again.rubric.version).toBe(NEXT_RUBRIC_VERSION);
    expect(event?.origin).toBe('backfill');
    expect(event?.rubricVersion).toBe(NEXT_RUBRIC_VERSION);
  });

  it('re-judges neither a pending run nor one with the same claims', () => {
    const queued = oneClaim();
    const done = judged(oneClaim(), true);

    expect(queued.rejudged(rubricOf(NEXT_RUBRIC_VERSION), NOW)).toBe(queued);
    expect(done.rejudged(done.rubric, NOW)).toBe(done);
  });

  it('judges a run again on a new rubric in a new round', () => {
    const first = oneClaim().leaseJob(NOW);
    const done = judged(oneClaim(), true);
    const next = rubricOf(NEXT_RUBRIC_VERSION, ['It retries twice.']);
    const again = done.rejudged(next, NOW).leaseJob(NOW);

    expect(first.round.attempt).toBe(1);
    expect(again.round.attempt).toBe(1);
    expect(again.round.rubricVersion).toBe(NEXT_RUBRIC_VERSION);
    expect(again.round.equals(first.round)).toBe(false);
    expect(() => done.round).toThrow(InvalidJudgingError);
  });

  it('tries again in a new round, and keeps its round while it waits', () => {
    const leased = oneClaim().leaseJob(NOW);
    const resumed = leased
      .waitJob(NOW)
      .leaseJob(new Date(NOW.getTime() + WAIT_MS));
    const retried = leased
      .failed(JudgingFailure.of('request-failed', NOW))
      .leaseJob(new Date(NOW.getTime() + 3_600_000));

    expect(resumed.round.equals(leased.round)).toBe(true);
    expect(retried.round.attempt).toBe(2);
  });

  it('wakes when the session of the round it waits on settles, and only then', () => {
    const leased = oneClaim().leaseJob(NOW);
    const waiting = leased.waitJob(NOW);
    const at = new Date(NOW.getTime() + 1_000);
    const woken = waiting.wake(leased.round, at);
    const otherRound = oneClaim()
      .leaseJob(NOW)
      .failed(JudgingFailure.of('request-failed', NOW))
      .leaseJob(new Date(NOW.getTime() + 3_600_000)).round;

    expect(woken.job?.nextAttemptAt).toEqual(at);
    expect(woken.job?.attempts).toBe(0);
    expect(woken.wake(leased.round, at)).toBe(woken);
    expect(waiting.wake(otherRound, at)).toBe(waiting);
    expect(leased.wake(leased.round, at)).toBe(leased);
  });
});
