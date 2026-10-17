import { InconsistentStateError } from '@shared-kernel/domain/exceptions/inconsistent-state.error';
import { HarnessId } from '@shared-kernel/domain/value-objects/harness-id.vo';
import { Provisioning } from '@shared-kernel/domain/value-objects/provisioning.vo';
import { RunId } from '@shared-kernel/domain/value-objects/run-id.vo';
import { RunnerId } from '@shared-kernel/domain/value-objects/runner-id.vo';
import { TeamId } from '@shared-kernel/domain/value-objects/team-id.vo';
import { WorkspaceId } from '@shared-kernel/domain/value-objects/workspace-id.vo';
import { Run } from '@work/domain/aggregates/run.aggregate';
import { RunCompleted } from '@work/domain/events/run-completed.event';
import { RunExhausted } from '@work/domain/events/run-exhausted.event';
import { InvalidRunTransitionError } from '@work/domain/exceptions/invalid-run-transition.error';
import { NotAllowedInSearchError } from '@work/domain/exceptions/not-allowed-in-search.error';
import { BriefedMemories } from '@work/domain/value-objects/briefed-memories.vo';
import { Handover } from '@work/domain/value-objects/handover.vo';
import { HandoverReport } from '@work/domain/value-objects/handover-report.vo';
import { RunOutcome } from '@work/domain/value-objects/run-outcome.vo';
import { RunPriority } from '@work/domain/value-objects/run-priority.vo';
import {
  RunSpec,
  type RunSpecParts,
} from '@work/domain/value-objects/run-spec.vo';
import { RunSubject } from '@work/domain/value-objects/run-subject.vo';
import { SearchId } from '@work/domain/value-objects/search-id.vo';
import { SearchIteration } from '@work/domain/value-objects/search-iteration.vo';
import { StationId } from '@work/domain/value-objects/station-id.vo';
import { describe, expect, it } from 'vitest';

const NOW = new Date('2026-10-02T09:00:00.000Z');
const RUNNER = RunnerId.of('runner_1');

const SEARCH = RunSubject.search(
  SearchId.of('search_1'),
  SearchIteration.of(1),
  StationId.of('station_1'),
  TeamId.of('team_1'),
);

const SEARCH_SPEC: RunSpecParts = {
  command: { executable: 'sh', args: [] },
  briefing: 'Find a better Build station.',
  handover: { options: [], noteLimit: 0 },
  continuity: { key: 'search-run_1' },
  search: {},
};

const queued = (
  subject: RunSubject | null = SEARCH,
  spec: RunSpecParts = SEARCH_SPEC,
  briefedWith: BriefedMemories = BriefedMemories.none(),
) =>
  Run.enqueue({
    id: RunId.of('run_1'),
    workspaceId: WorkspaceId.of('ws_1'),
    harness: HarnessId.of('dev'),
    priority: RunPriority.of(-2),
    subject,
    spec: RunSpec.of(spec),
    briefedWith,
  });

const claimed = () => queued().claim(RUNNER, NOW);

const finished = RunOutcome.of({ exitCode: 0, failed: false });

const reportOf = (next: string) =>
  HandoverReport.of({ handover: Handover.of({ next }), session: null });

describe('a search run', () => {
  it('works no task of its own, archives no workspace and restores none', () => {
    const run = queued();

    expect(run.isSearch).toBe(true);
    expect(run.isReplay).toBe(false);
    expect(run.leavesNothingBehind).toBe(true);
    expect(run.taskId).toBeNull();
    expect(run.ranFor?.value).toBe('team_1');
    expect(run.archiveHolder).toBeNull();
    expect(run.restoresFrom).toBeNull();
    expect(run.restoresArchive).toBeNull();
  });

  it('searches only from a spec that says it searches, and the other way round', () => {
    expect(() => queued(SEARCH, { ...SEARCH_SPEC, search: undefined })).toThrow(
      InvalidRunTransitionError,
    );
    expect(() => queued(null, SEARCH_SPEC)).toThrow(InvalidRunTransitionError);
  });

  it('is briefed with nothing the team remembers', () => {
    expect(() =>
      queued(
        SEARCH,
        SEARCH_SPEC,
        BriefedMemories.of({
          briefed: [{ id: 'memory_1', handle: 'M-1' }],
          cut: [],
        }),
      ),
    ).toThrow(InvalidRunTransitionError);
  });

  it('never waits for a person', () => {
    expect(() =>
      claimed().paused(RUNNER, finished, reportOf('review'), NOW),
    ).toThrow(InvalidRunTransitionError);
  });

  it('ends recording that it asked a person, when its runner says so, and only then', () => {
    const asked = claimed()
      .askedAPersonBy(RUNNER)
      .complete(RUNNER, finished, reportOf('review'));
    const [completed] = asked
      .pullEvents()
      .filter((each): each is RunCompleted => each instanceof RunCompleted);

    expect(asked.askedAPerson).toBe(true);
    expect(completed?.asked).toBe(true);
    expect(
      claimed().complete(RUNNER, finished, reportOf('review')).askedAPerson,
    ).toBe(false);
  });

  it('is exhausted rather than going back on the queue once it has asked a person', () => {
    const expired = claimed()
      .askedAPersonBy(RUNNER)
      .expireLease(new Date(NOW.getTime() + 120_000));
    const [exhausted] = expired
      .pullEvents()
      .filter((each): each is RunExhausted => each instanceof RunExhausted);

    expect(expired.hasEnded).toBe(true);
    expect(exhausted?.asked).toBe(true);
  });

  it('acts on nothing beyond itself, and fires no hook', () => {
    expect(() =>
      claimed().mayActBeyondItself('reply to a review comment'),
    ).toThrow(NotAllowedInSearchError);
    expect(claimed().firesHooks).toBe(false);
  });

  it('comes back only with a spec that says it searches', () => {
    const stored = {
      id: RunId.of('run_1'),
      workspaceId: WorkspaceId.of('ws_1'),
      harness: HarnessId.of('dev'),
      priority: RunPriority.of(-2),
      subject: SEARCH,
      state: 'queued' as const,
      claimedBy: null,
      leaseExpiresAt: null,
      outcome: null,
      attempt: 1,
      reservation: null,
      provisioning: Provisioning.none(),
    };

    expect(
      Run.rehydrate({ ...stored, spec: RunSpec.of(SEARCH_SPEC) }).isSearch,
    ).toBe(true);
    expect(() =>
      Run.rehydrate({
        ...stored,
        spec: RunSpec.of({ ...SEARCH_SPEC, search: undefined }),
      }),
    ).toThrow(InconsistentStateError);
  });
});
