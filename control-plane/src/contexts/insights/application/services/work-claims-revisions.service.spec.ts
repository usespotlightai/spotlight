import { JudgingError } from '@insights/application/errors/judging.error';
import type { ClaimsDraftRequest } from '@insights/application/ports/claims-drafter.port';
import type { JudgeClaimsPullRequest } from '@insights/application/ports/judge-claims-pull-requests.port';
import type { JudgeRequest } from '@insights/application/ports/judge.port';
import type { StationJudge } from '@insights/application/ports/station-judges.port';
import { LabelledRuns } from '@insights/application/services/labelled-runs.service';
import { ProposeClaimsRevisions } from '@insights/application/services/propose-claims-revisions.service';
import { WorkClaimsRevisions } from '@insights/application/services/work-claims-revisions.service';
import { ClaimsRevisionPicked } from '@insights/domain/events/claims-revision-picked.event';
import { MAX_REVISION_JUDGE_CALLS } from '@insights/domain/services/revision-pick';
import {
  judgeOf,
  judgesWith,
  NEXT_JUDGE,
  NOW,
  stationWith,
} from '@insights/judge-repair-setup.fake-spec';
import {
  ClaimsRevisionsInMemory,
  JudgeDisagreementsInMemory,
  answeredDisagreement,
  startedRevision,
} from '@insights/judge-repair.fake-spec';
import { CLAIMS, judgeScore } from '@insights/judging.fake-spec';
import { inTransaction } from '@insights/runs.fake-spec';
import type { LoggerPort } from '@shared-kernel/application/ports/logger.port';
import { telemetryInMemory } from '@shared-kernel/application/ports/telemetry.fake-spec';
import { TaskId } from '@shared-kernel/domain/value-objects/task-id.vo';
import { describe, expect, it } from 'vitest';

const logger: LoggerPort = {
  info: () => {},
  warn: () => {},
  error: () => {},
  debug: () => {},
};

const BETTER = ['It retries the upload and a person accepts that.'];

const WORSE = ['It never retries.'];

const runIds = (count: number) =>
  Array.from({ length: count }, (_, at) => `run_${at}`);

const accepts = (runId: string): boolean =>
  Number(runId.split('_')[1]) % 2 === 0;

const verdictFor = (request: JudgeRequest, met: boolean) => ({
  model: 'some/model',
  guidance: null,
  verdict: {
    claims: request.claims.map((_, index) => ({
      index,
      met,
      reasons: [{ text: 'It retried.', steps: [1], hunks: [] }],
    })),
  },
});

interface Options {
  readonly runs?: number;
  readonly drafted?: readonly (readonly string[])[];
  readonly judge?: StationJudge;
  readonly failing?: boolean;
}

const revising = async (options: Options = {}) => {
  const ids = runIds(options.runs ?? 40);
  const station = await stationWith(
    ids.map((runId) => ({
      runId,
      acted: accepts(runId) ? ('accepted' as const) : ('sent-back' as const),
      scores: [
        judgeScore(runId, [true, false, false], {
          at: new Date(NOW.getTime() - Number(runId.split('_')[1]) * 1_000),
        }),
      ],
    })),
  );
  const disagreements = new JudgeDisagreementsInMemory();
  const disagreement = answeredDisagreement(
    'run_0',
    [
      [1, 'claim-wrong', 'The test sits in another file.'],
      [2, 'claim-wrong'],
    ],
    NOW,
  );
  disagreements.stored.set(disagreement.id.value, disagreement);
  const revisions = new ClaimsRevisionsInMemory();
  await revisions.add(startedRevision());
  const judged: JudgeRequest[] = [];
  const drafts: ClaimsDraftRequest[] = [];
  const requested: JudgeClaimsPullRequest[] = [];
  const clock = { now: () => NOW, sleep: async () => {} };
  const work = new WorkClaimsRevisions(
    {
      revisions,
      disagreements,
      labelled: new LabelledRuns(station.facts),
      judges: judgesWith(options.judge ?? judgeOf()),
      evidence: {
        hasTask: async () => true,
        of: async (runId) => ({
          runId,
          taskId: TaskId.of(`task_${runId.value}`),
          title: runId.value,
          description: null,
          steps: [
            {
              index: 1,
              kind: 'message',
              tool: null,
              text: 'Retrying.',
              input: null,
              output: null,
            },
          ],
          hunks: [],
        }),
      },
      judge: {
        available: true,
        judge: async (request) => {
          judged.push(request);
          if (options.failing) {
            throw new JudgingError('request-failed', 'down');
          }
          return verdictFor(
            request,
            request.claims[0] === BETTER[0]
              ? accepts(request.title)
              : request.claims[0] === WORSE[0]
                ? !accepts(request.title)
                : false,
          );
        },
      },
      drafter: {
        available: true,
        drafted: async (request) => {
          drafts.push(request);
          return options.drafted ?? [WORSE, CLAIMS, BETTER];
        },
      },
    },
    clock,
    inTransaction,
    logger,
    { report: () => undefined },
    telemetryInMemory(),
  );

  const proposing = new ProposeClaimsRevisions(
    revisions,
    disagreements,
    {
      request: async (request) => {
        requested.push(request);
      },
    },
    inTransaction,
    clock,
  );

  await work.processDue();
  await work.idle();

  const revised = () => [...revisions.stored.values()][0];
  const picked = async () => {
    const revision = revised();

    if (revision) {
      await proposing.picked(
        new ClaimsRevisionPicked(
          revision.id,
          revision.station.workspaceId,
          revision.station.stationId,
        ),
      );
    }
  };

  return { revised, judged, drafts, requested, proposing, picked, revisions };
};

const URL = 'https://github.com/acme/config/pull/7';

describe('WorkClaimsRevisions', () => {
  it('picks the best candidate, keeps it with its agreement, and only then asks Replays for the pull request', async () => {
    const { revised, requested, drafts, judged, picked, proposing } =
      await revising();

    expect(revised()?.awaitsPullRequest).toBe(true);
    expect(revised()?.pick?.claims).toEqual(BETTER);
    expect(requested).toEqual([]);
    expect(revised()?.judgeCalls).toBe(80);
    expect(judged).toHaveLength(80);
    expect(drafts[0]?.cases).toHaveLength(1);
    expect(drafts[0]?.cases[0]?.answers).toEqual([
      {
        claim: 1,
        answer: 'claim-wrong',
        note: 'The test sits in another file.',
      },
      { claim: 2, answer: 'claim-wrong', note: null },
    ]);
    expect(drafts[0]?.claims).toEqual(CLAIMS);

    await picked();

    expect(requested[0]?.claimsBefore).toEqual(CLAIMS);
    expect(requested[0]?.claimsAfter).toEqual(BETTER);
    expect(requested[0]?.heldOut.after).toBe(1);
    expect(requested[0]?.heldOut.before).toBe(0);
    expect(
      (requested[0]?.searched.runs ?? 0) + (requested[0]?.heldOut.runs ?? 0),
    ).toBe(40);
    expect(requested[0]?.disagreementRuns).toEqual([
      {
        runId: 'run_0',
        taskId: 'task_run_0',
        direction: 'judge-failed',
        claimsWrong: [1, 2],
        notes: [{ claim: 1, text: 'The test sits in another file.' }],
      },
    ]);

    await proposing.opened({ revisionId: revised()?.id.value ?? '', url: URL });

    expect(revised()?.outcome?.kind).toBe('proposed');
    expect(revised()?.outcome?.claims).toEqual(BETTER);
    expect(revised()?.outcome?.pullRequest).toBe(URL);
  });

  it('uses at most the 50 newest labelled runs', async () => {
    const { judged } = await revising({ runs: 60, drafted: [BETTER] });

    expect(new Set(judged.map((each) => each.title)).size).toBe(50);
    expect(judged.some((each) => each.title === 'run_59')).toBe(false);
  });

  it('ends without a pull request when no candidate beats the live judge', async () => {
    const { revised, requested, picked } = await revising({ drafted: [WORSE] });
    await picked();

    expect(revised()?.outcome?.reason).toBe('no-gain');
    expect(revised()?.outcome?.agreement?.heldOut.after).toBeLessThan(0);
    expect(requested).toEqual([]);
  });

  it('ends when too few labelled runs are held out', async () => {
    const { revised, judged } = await revising({ runs: 4 });

    expect(revised()?.outcome?.reason).toBe('too-few-labelled-runs');
    expect(judged).toEqual([]);
  });

  it('ends when the drafts only repeat the live claims', async () => {
    const { revised, judged } = await revising({ drafted: [CLAIMS] });

    expect(revised()?.outcome?.reason).toBe('no-candidates');
    expect(judged).toEqual([]);
  });

  it('ends when the judge claims changed since it started', async () => {
    const { revised } = await revising({ judge: NEXT_JUDGE });

    expect(revised()?.outcome?.reason).toBe('judge-changed');
  });

  it('ends with the reason Replays gives when the pull request cannot be opened', async () => {
    const { revised, proposing } = await revising();

    await proposing.failed({
      revisionId: revised()?.id.value ?? '',
      reason: 'File line.tf not found.',
    });

    expect(revised()?.outcome?.reason).toBe('pull-request-failed');
    expect(revised()?.outcome?.message).toBe('File line.tf not found.');
    expect(revised()?.outcome?.agreement?.heldOut.after).toBe(1);
  });

  it('reserves 50 runs × 3 candidates = 150 judge calls once, and asking again for the pull request judges nothing more', async () => {
    const { revised, judged, requested, picked, proposing } = await revising({
      runs: 60,
      drafted: [WORSE, BETTER, ['It retries the upload.']],
    });

    expect(judged).toHaveLength(MAX_REVISION_JUDGE_CALLS);
    expect(revised()?.judgeCalls).toBe(MAX_REVISION_JUDGE_CALLS);
    expect(revised()?.judgeCallsLeft).toBe(0);
    expect(revised()?.pick?.claims).toEqual(BETTER);

    await picked();
    await picked();
    await proposing.opened({ revisionId: revised()?.id.value ?? '', url: URL });
    await picked();

    expect(requested).toHaveLength(2);
    expect(requested[1]).toEqual(requested[0]);
    expect(judged).toHaveLength(MAX_REVISION_JUDGE_CALLS);
    expect(revised()?.judgeCalls).toBe(MAX_REVISION_JUDGE_CALLS);
    expect(revised()?.outcome?.kind).toBe('proposed');
  });

  it('counts a failed judge call and leaves its run out', async () => {
    const { revised } = await revising({ failing: true, drafted: [BETTER] });

    expect(revised()?.outcome?.reason).toBe('no-gain');
    expect(revised()?.judgeCalls).toBe(40);
  });
});
