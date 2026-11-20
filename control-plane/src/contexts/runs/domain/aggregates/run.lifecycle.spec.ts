import { Run } from '@runs/domain/aggregates/run.aggregate';
import { claimer, orderedFor } from '@runs/domain/aggregates/run.fake-spec';
import { RunCancelled } from '@runs/domain/events/run-cancelled.event';
import { RunEnded } from '@runs/domain/events/run-ended.event';
import { RunExhausted } from '@runs/domain/events/run-exhausted.event';
import { InvalidRunTransitionError } from '@runs/domain/exceptions/invalid-run-transition.error';
import { ExitCode } from '@runs/domain/value-objects/exit-code.vo';
import { HandoverReport } from '@runs/domain/value-objects/handover-report.vo';
import { Handover } from '@runs/domain/value-objects/handover.vo';
import { HarnessSession } from '@runs/domain/value-objects/harness-session.vo';
import { RunOutcome } from '@runs/domain/value-objects/run-outcome.vo';
import { RunSpec } from '@runs/domain/value-objects/run-spec.vo';
import type { DomainEvent } from '@shared-kernel/domain/events/domain-event';
import { HarnessId } from '@shared-kernel/domain/value-objects/harness-id.vo';
import { RunId } from '@shared-kernel/domain/value-objects/run-id.vo';
import { RunnerId } from '@shared-kernel/domain/value-objects/runner-id.vo';
import { RunnerImage } from '@shared-kernel/domain/value-objects/runner-image.vo';
import { WorkspaceId } from '@shared-kernel/domain/value-objects/workspace-id.vo';
import fc from 'fast-check';
import { describe, it } from 'vitest';

const START = new Date('2026-09-29T09:00:00.000Z');
const RUNNERS = ['runner_a', 'runner_b'] as const;
const IMAGE = RunnerImage.of(`ghcr.io/acme/widgets@sha256:${'e'.repeat(64)}`);
const REPORT = HandoverReport.of({
  handover: Handover.of({ next: 'review', note: 'Which queue?' }),
  session: HarnessSession.of('session_1'),
});

const ORDERINGS = {
  holdingTurn: () => orderedFor.holdingTurn('task_1'),
  conversing: () => orderedFor.conversing('chat_1'),
  spec: () => orderedFor.spec('run_1'),
  isolated: () => orderedFor.isolated('run_1'),
};

type Ordering = keyof typeof ORDERINGS;
type Runner = (typeof RUNNERS)[number];

type RunnerAction =
  | 'claim'
  | 'renew'
  | 'start'
  | 'unclaim'
  | 'requeue'
  | 'time-out'
  | 'ask-a-person';

type RunnerReport = 'complete' | 'report-turn';

type OtherAction =
  | 'expire-lease'
  | 'keep'
  | 'finish'
  | 'stop'
  | 'cancel'
  | 'cancel-if-queued';

type Step =
  | { readonly kind: 'wait'; readonly ms: number }
  | { readonly kind: RunnerAction; readonly runner: Runner }
  | {
      readonly kind: RunnerReport;
      readonly runner: Runner;
      readonly failed: boolean;
    }
  | { readonly kind: 'resume'; readonly because: 'messages' | 'answered' }
  | { readonly kind: OtherAction };

const runner = fc.constantFrom(...RUNNERS);

const byRunner = (kind: RunnerAction): fc.Arbitrary<Step> =>
  runner.map((each) => ({ kind, runner: each }));

const ending = (kind: RunnerReport): fc.Arbitrary<Step> =>
  fc.record({ kind: fc.constant(kind), runner, failed: fc.boolean() });

const bare = (kind: OtherAction): fc.Arbitrary<Step> => fc.constant({ kind });

const step: fc.Arbitrary<Step> = fc.oneof(
  {
    weight: 3,
    arbitrary: fc.record({
      kind: fc.constant('wait' as const),
      ms: fc.oneof(
        fc.integer({ min: 0, max: 90_000 }),
        fc.integer({ min: 90_000, max: 900_000 }),
      ),
    }),
  },
  { weight: 4, arbitrary: byRunner('claim') },
  { weight: 2, arbitrary: byRunner('renew') },
  { weight: 1, arbitrary: byRunner('start') },
  { weight: 1, arbitrary: byRunner('unclaim') },
  { weight: 1, arbitrary: byRunner('requeue') },
  { weight: 2, arbitrary: byRunner('time-out') },
  { weight: 1, arbitrary: byRunner('ask-a-person') },
  { weight: 1, arbitrary: ending('complete') },
  { weight: 3, arbitrary: ending('report-turn') },
  {
    weight: 2,
    arbitrary: fc.record({
      kind: fc.constant('resume' as const),
      because: fc.constantFrom('messages' as const, 'answered' as const),
    }),
  },
  { weight: 2, arbitrary: bare('expire-lease') },
  { weight: 1, arbitrary: bare('keep') },
  { weight: 1, arbitrary: bare('finish') },
  { weight: 2, arbitrary: bare('stop') },
  { weight: 1, arbitrary: bare('cancel') },
  { weight: 1, arbitrary: bare('cancel-if-queued') },
);

const ordering: fc.Arbitrary<Ordering> = fc.oneof(
  { weight: 4, arbitrary: fc.constant('holdingTurn' as const) },
  {
    weight: 3,
    arbitrary: fc.constantFrom(
      'conversing' as const,
      'spec' as const,
      'isolated' as const,
    ),
  },
);

const outcome = (failed: boolean) =>
  RunOutcome.of({ exitCode: ExitCode.of(failed ? 1 : 0), failed });

const actsAsRunner = (each: Step): each is Extract<Step, { runner: Runner }> =>
  'runner' in each;

const queued = (kind: Ordering): Run => {
  const run = Run.enqueue({
    id: RunId.of('run_1'),
    workspaceId: WorkspaceId.of('ws_1'),
    harness: HarnessId.of('dev'),
    ...ORDERINGS[kind](),
    spec: RunSpec.of({
      command: { executable: 'sh', args: [] },
      briefing: 'Fix the queue.',
      handover: { options: [], noteLimit: 0 },
      resume: {},
    }),
  });

  run.pullEvents();

  return run;
};

type ByRunner = Extract<Step, { readonly runner: Runner }>;

type Acting = Exclude<Step, { readonly kind: 'wait' }>;

const appliedBy = (run: Run, each: ByRunner, now: Date): Run => {
  const by = RunnerId.of(each.runner);

  switch (each.kind) {
    case 'claim':
      return run.claim(claimer(by), now);
    case 'renew':
      return run.renewLease(by, now);
    case 'start':
      return run.startedIn(by, IMAGE, now);
    case 'unclaim':
      return run.unclaimedBy(by, now);
    case 'requeue':
      return run.requeue(by, now, 'no answer');
    case 'time-out':
      return run.timedOut(by, now);
    case 'ask-a-person':
      return run.askedAPersonBy(by);
    case 'complete':
      return run.complete(by, outcome(each.failed), REPORT, now);
    case 'report-turn':
      return run.reportTurn(by, outcome(each.failed), REPORT, now);
  }
};

const applied = (run: Run, each: Acting, now: Date): Run => {
  if (actsAsRunner(each)) {
    return appliedBy(run, each, now);
  }

  switch (each.kind) {
    case 'expire-lease':
      return run.expireLease(now);
    case 'keep':
      return run.keep(run.attempt, now);
    case 'resume':
      return run.resumed(run.attempt, each.because, [], now);
    case 'finish':
      return run.finished(run.attempt);
    case 'stop':
      return run.requestStop(now);
    case 'cancel':
      return run.cancel('cancelled by a person', now).run;
    case 'cancel-if-queued':
      return run.cancelledIfQueued('cancelled by a person', now).run;
  }
};

const ENDINGS = [RunEnded, RunCancelled, RunExhausted];

const endingsIn = (events: readonly DomainEvent[]): number =>
  events.filter((event) => ENDINGS.some((type) => event instanceof type))
    .length;

interface Visit {
  readonly before: Run;
  readonly after: Run;
  readonly step: Acting;
  readonly accepted: boolean;
  readonly endings: number;
  readonly now: Date;
}

const walk = (kind: Ordering, steps: readonly Step[]): readonly Visit[] => {
  let run = queued(kind);
  let now = START;
  let endings = 0;
  const visits: Visit[] = [];

  for (const each of steps) {
    if (each.kind === 'wait') {
      now = new Date(now.getTime() + each.ms);
      continue;
    }

    const before = run;
    let accepted = true;

    try {
      run = applied(run, each, now);
    } catch (error) {
      if (!(error instanceof InvalidRunTransitionError)) {
        throw error;
      }
      accepted = false;
    }

    endings += endingsIn(run.pullEvents());
    visits.push({ before, after: run, step: each, accepted, endings, now });
  }

  return visits;
};

const steps = fc.array(step, { maxLength: 50, size: 'max' });

const RUNS = { numRuns: 2_000 };

const lifecycle = (holds: (visit: Visit) => boolean) =>
  fc.property(ordering, steps, (kind, each) => walk(kind, each).every(holds));

const heldAlike = (before: Run, after: Run): boolean =>
  before.claimedBy !== null &&
  after.claimedBy !== null &&
  before.claimedBy.equals(after.claimedBy) &&
  before.attempt.equals(after.attempt);

const leaseMovedBack = (before: Run, after: Run): boolean =>
  before.leaseExpiresAt !== null &&
  after.leaseExpiresAt !== null &&
  heldAlike(before, after) &&
  after.leaseExpiresAt.getTime() < before.leaseExpiresAt.getTime();

describe('a run under any order of runner, sweeper and person actions', () => {
  it('holds a lease exactly while it is claimed', () => {
    fc.assert(
      lifecycle(
        ({ after }) =>
          (after.leaseExpiresAt !== null) === (after.state === 'claimed') &&
          (after.state !== 'claimed' || after.claimedBy !== null),
      ),
      RUNS,
    );
  });

  it('has no runner while it is queued or suspended', () => {
    fc.assert(
      lifecycle(
        ({ after }) =>
          (after.state !== 'queued' && after.state !== 'suspended') ||
          after.claimedBy === null,
      ),
      RUNS,
    );
  });

  it('lets only the runner that holds the claim act on it', () => {
    fc.assert(
      lifecycle(
        ({ before, step: each, accepted }) =>
          !actsAsRunner(each) ||
          each.kind === 'claim' ||
          !accepted ||
          (before.state === 'claimed' &&
            before.claimedBy?.value === each.runner),
      ),
      RUNS,
    );
  });

  it('never moves a lease back while the same runner holds the same attempt', () => {
    fc.assert(
      lifecycle(({ before, after }) => !leaseMovedBack(before, after)),
      RUNS,
    );
  });

  it('stays ended once it ends, whatever comes after', () => {
    fc.assert(
      lifecycle(
        ({ before, after }) =>
          !before.hasEnded ||
          (after.state === before.state &&
            after.outcome === before.outcome &&
            after.endedAt === before.endedAt &&
            after.leaseExpiresAt === null),
      ),
      RUNS,
    );
  });

  it('records its end once, and only when it ends', () => {
    fc.assert(
      lifecycle(
        ({ after, endings }) =>
          endings === (after.hasEnded ? 1 : 0) &&
          (!after.hasEnded ||
            (after.outcome !== null && after.endedAt !== null)),
      ),
      RUNS,
    );
  });

  it('never goes back on the queue once a stop is requested', () => {
    fc.assert(
      lifecycle(
        ({ after }) => !after.stopRequested || after.state !== 'queued',
      ),
      RUNS,
    );
  });

  it('loses its lease to the sweeper only once the lease has run out', () => {
    fc.assert(
      lifecycle(
        ({ before, step: each, accepted, now }) =>
          each.kind !== 'expire-lease' ||
          !accepted ||
          (before.leaseExpiresAt !== null &&
            before.leaseExpiresAt.getTime() <= now.getTime()),
      ),
      RUNS,
    );
  });

  it('counts attempts up one at a time', () => {
    fc.assert(
      lifecycle(({ before, after }) =>
        [0, 1].includes(after.attempt.number - before.attempt.number),
      ),
      RUNS,
    );
  });
});
