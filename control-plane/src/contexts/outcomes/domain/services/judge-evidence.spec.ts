import { InvalidScoreError } from '@outcomes/domain/exceptions/invalid-score.error';
import {
  type JudgedStep,
  JudgeEvidence,
} from '@outcomes/domain/services/judge-evidence';
import { RunId } from '@shared-kernel/domain/value-objects/run-id.vo';
import { describe, expect, it } from 'vitest';

const stepOf = (index: number, text = `step ${index}`): JudgedStep => ({
  index,
  kind: 'message',
  tool: null,
  text,
  given: null,
  returned: null,
});

const evidenceOf = (steps: readonly JudgedStep[] = [stepOf(3), stepOf(7)]) =>
  JudgeEvidence.of({
    runId: RunId.of('run_1'),
    title: 'Retry uploads',
    description: null,
    steps,
    hunks: [
      {
        id: 'api/src/uploads.ts#1',
        path: 'api/src/uploads.ts',
        header: '@@ -1 +1 @@',
        lines: ['-a', '+b'],
      },
    ],
  });

describe('JudgeEvidence', () => {
  it('grounds a reason in the steps and hunks the judge read', () => {
    const reason = evidenceOf().reasonOf({
      text: 'It retried in the request.',
      steps: [7],
      hunks: ['api/src/uploads.ts#1'],
    });

    expect(reason.citations.map((each) => each.kind)).toEqual(['step', 'hunk']);
  });

  it('rejects a reason citing a step that is not there', () => {
    expect(() =>
      evidenceOf().reasonOf({ text: 'It retried.', steps: [99], hunks: [] }),
    ).toThrow(InvalidScoreError);
  });

  it('rejects a reason citing a hunk that is not there', () => {
    expect(() =>
      evidenceOf().reasonOf({
        text: 'It retried.',
        steps: [],
        hunks: ['api/src/other.ts#4'],
      }),
    ).toThrow(InvalidScoreError);
  });

  it('rejects a reason citing nothing', () => {
    expect(() =>
      evidenceOf().reasonOf({ text: 'It retried.', steps: [], hunks: [] }),
    ).toThrow(InvalidScoreError);
  });

  it('keeps only the grounded reasons of a verdict', () => {
    expect(
      evidenceOf().groundedReasons([
        { text: 'Grounded.', steps: [3], hunks: [] },
        { text: 'Made up.', steps: [42], hunks: [] },
      ]),
    ).toHaveLength(1);
  });

  it('leaves the earliest steps out for length, keeping each step’s place', () => {
    const long = 'x'.repeat(30_000);
    const evidence = evidenceOf([
      stepOf(0, long),
      stepOf(1, long),
      stepOf(2, long),
      stepOf(3, long),
    ]);

    expect(evidence.steps.map((each) => each.index)).toEqual([2, 3]);
    expect(evidence.stepsLeftOut).toBe(2);
    expect(() =>
      evidence.reasonOf({ text: 'Early on.', steps: [0], hunks: [] }),
    ).toThrow(InvalidScoreError);
  });

  it('clips the task’s title and description', () => {
    const evidence = JudgeEvidence.of({
      runId: RunId.of('run_1'),
      title: 't'.repeat(1_000),
      description: 'd'.repeat(10_000),
      steps: [],
      hunks: [],
    });

    expect(evidence.title.length).toBeLessThanOrEqual(302);
    expect(evidence.description?.length).toBeLessThanOrEqual(4_002);
  });

  it('clips each hunk line, and leaves the last hunks out once their characters run long', () => {
    const hunks = Array.from({ length: 200 }, (_, at) => ({
      id: `api/src/big.ts#${at + 1}`,
      path: 'api/src/big.ts',
      header: '@@ -1 +1 @@',
      lines: [`+${'x'.repeat(2_000)}`],
    }));
    const evidence = JudgeEvidence.of({
      runId: RunId.of('run_1'),
      title: 'Big change',
      description: null,
      steps: [],
      hunks,
    });

    expect(evidence.hunks[0]?.lines[0]?.length).toBeLessThanOrEqual(502);
    expect(evidence.hunks.length).toBeLessThan(200);
    expect(evidence.hunksLeftOut).toBe(200 - evidence.hunks.length);
    expect(
      evidence.hunks.reduce(
        (sum, hunk) => sum + hunk.lines.join('').length + hunk.header.length,
        0,
      ),
    ).toBeLessThanOrEqual(60_000);
  });

  it('tells a long hunk’s first lines and says how many it left out, then goes on to the next hunks', () => {
    const evidence = JudgeEvidence.of({
      runId: RunId.of('run_1'),
      title: 'New module',
      description: null,
      steps: [],
      hunks: [
        {
          id: 'api/src/generated.ts#1',
          path: 'api/src/generated.ts',
          header: '@@ -0,0 +1,1500 @@',
          lines: Array.from(
            { length: 1_500 },
            (_, at) => `+export const value${at} = ${at};`,
          ),
        },
        {
          id: 'api/src/uploads.ts#1',
          path: 'api/src/uploads.ts',
          header: '@@ -1 +1 @@',
          lines: ['-upload()', '+retry(upload)'],
        },
      ],
    });

    const [generated, uploads] = evidence.hunks;
    expect(generated?.lines).toHaveLength(201);
    expect(generated?.lines[200]).toBe('… 1300 more lines');
    expect(uploads?.id).toBe('api/src/uploads.ts#1');
    expect(evidence.hunksLeftOut).toBe(0);
  });

  it('goes on past a hunk that does not fit, counting each one it leaves out', () => {
    const wide = (id: string) => ({
      id,
      path: 'api/src/wide.ts',
      header: '@@ -1 +1 @@',
      lines: Array.from({ length: 200 }, () => `+${'x'.repeat(400)}`),
    });
    const evidence = JudgeEvidence.of({
      runId: RunId.of('run_1'),
      title: 'Wide change',
      description: null,
      steps: [],
      hunks: [
        wide('api/src/wide.ts#1'),
        wide('api/src/wide.ts#2'),
        {
          id: 'api/src/uploads.ts#1',
          path: 'api/src/uploads.ts',
          header: '@@ -1 +1 @@',
          lines: ['+retry(upload)'],
        },
      ],
    });

    expect(evidence.hunks.map((each) => each.id)).toEqual([
      'api/src/uploads.ts#1',
    ]);
    expect(evidence.hunksLeftOut).toBe(2);
  });

  it('counts a fixed share of the budget for every step, however short', () => {
    const evidence = evidenceOf(
      Array.from({ length: 5_000 }, (_, at) => stepOf(at, '')),
    );

    expect(evidence.steps.length).toBeLessThan(5_000);
    expect(evidence.stepsLeftOut).toBe(5_000 - evidence.steps.length);
  });

  it('keeps once each step and hunk its reasons cite, as the judge read them', () => {
    const evidence = evidenceOf();
    const reasons = evidence.groundedReasons([
      { text: 'It retried.', steps: [7], hunks: ['api/src/uploads.ts#1'] },
      { text: 'It retried again.', steps: [7], hunks: [] },
    ]);

    const seen = evidence.seenFor(reasons);

    expect(seen.steps).toEqual([
      { index: 7, kind: 'message', tool: null, text: 'step 7' },
    ]);
    expect(seen.hunks.map((each) => each.id)).toEqual(['api/src/uploads.ts#1']);
  });
});
