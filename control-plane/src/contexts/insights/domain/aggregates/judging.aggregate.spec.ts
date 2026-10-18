import type { Judging } from '@insights/domain/aggregates/judging.aggregate';
import type { RunJudged } from '@insights/domain/events/run-judged.event';
import { InvalidScoreError } from '@insights/domain/exceptions/invalid-score.error';
import { queuedJudging, rubricOf } from '@insights/domain/judging.fake-spec';
import { JudgeEvidence } from '@insights/domain/services/judge-evidence';
import { JudgingFailure } from '@insights/domain/value-objects/judging-failure.vo';
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

const judged = (
  judging: Judging,
  value: boolean | number,
  reasons = GROUNDED,
) =>
  judging.recordVerdict({
    verdict: { value, reasons },
    evidence: evidenceFor(),
    model: 'some/model',
    now: NOW,
  });

describe('Judging', () => {
  it('has a pending job until it is judged', () => {
    const queued = queuedJudging();

    expect(queued.hasPendingJob).toBe(true);
    expect(queued.pullEvents()).toEqual([]);
  });

  it('records the judge’s grounded verdict on the rubric’s scale', () => {
    const done = judged(queuedJudging(), true);
    const [event] = done.pullEvents() as RunJudged[];

    expect(done.hasPendingJob).toBe(false);
    expect(done.judgedAt).toEqual(NOW);
    expect(event?.kind).toBe('judging.judged');
    expect(event?.value).toBe(1);
    expect(event?.reasons).toHaveLength(1);
  });

  it('reads a number verdict on a 1 to 5 rubric', () => {
    const done = judged(
      queuedJudging('run_1', rubricOf('scores: 1-5\nHow well?')),
      4,
    );

    expect((done.pullEvents()[0] as RunJudged).value).toBe(4);
  });

  it('records a live run’s verdict claim by claim on a judge of claims, a score like any other', () => {
    const queued = queuedJudging(
      'run_1',
      rubricOf(null, undefined, ['It retries.', 'It adds a test.'], 0.5),
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

    expect(event?.scale.kind).toBe('claims');
    expect(event?.value).toBe(0.5);
    expect(event?.claimResults).toEqual([true, false]);
    expect(event?.reasons.map((each) => each.claim)).toEqual([0, 1]);
  });

  it('retries later when every reason cites what is not there', () => {
    const done = judged(queuedJudging(), true, [
      { text: 'Made up.', steps: [99], hunks: [] },
    ]);

    expect(done.hasPendingJob).toBe(true);
    expect(done.job?.nextAttemptAt?.getTime()).toBeGreaterThan(NOW.getTime());
    expect(done.pullEvents()).toEqual([]);
  });

  it('retries later unless most of its reasons cite what the judge read', () => {
    const half = judged(queuedJudging(), true, [
      ...GROUNDED,
      { text: 'Made up.', steps: [99], hunks: [] },
    ]);
    const mostlyGrounded = judged(queuedJudging(), true, [
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
    const event = judged(queuedJudging(), true).pullEvents()[0] as RunJudged;
    const [citation] = event.reasons[0]?.citations ?? [];

    expect(event.seen.stepAt(citation?.step ?? -1)?.text).toBe(
      'Retrying in the request.',
    );
  });

  it('retries later when the verdict gives more than five reasons', () => {
    const done = judged(
      queuedJudging(),
      true,
      Array.from({ length: 6 }, () => GROUNDED[0] as (typeof GROUNDED)[0]),
    );

    expect(done.hasPendingJob).toBe(true);
  });

  it('retries later when the verdict is off the rubric’s scale', () => {
    const done = judged(queuedJudging(), 3);

    expect(done.hasPendingJob).toBe(true);
    expect(done.pullEvents()).toEqual([]);
  });

  it('is judged only on its own run’s evidence', () => {
    expect(() =>
      queuedJudging().recordVerdict({
        verdict: { value: true, reasons: GROUNDED },
        evidence: evidenceFor('run_2'),
        model: 'some/model',
        now: NOW,
      }),
    ).toThrow(InvalidScoreError);
  });

  it('fails where there is nothing to judge', () => {
    const done = queuedJudging()
      .leaseJob(NOW)
      .failed(JudgingFailure.of('no-evidence', NOW));

    expect(done.hasPendingJob).toBe(false);
    expect(done.failure?.code).toBe('no-evidence');
  });

  it('is leased while it is worked on, and is dead-lettered once it keeps being interrupted', () => {
    let judging = queuedJudging();

    for (let attempt = 0; attempt < 4; attempt += 1) {
      judging = judging.leaseJob(new Date(NOW.getTime() + attempt * 3_600_000));
    }

    expect(judging.jobExhausted).toBe(true);
    expect(judging.deadLetter(NOW).failure?.code).toBe('interrupted');
  });

  it('ignores a verdict once it is done', () => {
    const done = judged(queuedJudging(), true);
    done.pullEvents();

    expect(judged(done, false)).toBe(done);
  });
});
