import { ScoreRecorded } from '@outcomes/domain/events/score-recorded.event';
import { InvalidScoreError } from '@outcomes/domain/exceptions/invalid-score.error';
import type { JudgeReason } from '@outcomes/domain/value-objects/judge-reason.vo';
import { isRubricVersion } from '@outcomes/domain/value-objects/rubric.vo';
import type { RunPlace } from '@outcomes/domain/value-objects/run-place.vo';
import type { ScoreId } from '@outcomes/domain/value-objects/score-id.vo';
import {
  type ScoreScale,
  shareMet,
} from '@outcomes/domain/value-objects/score-scale.vo';
import type { ScoreSource } from '@outcomes/domain/value-objects/score-source';
import { SeenEvidence } from '@outcomes/domain/value-objects/seen-evidence.vo';
import { EventRecorder } from '@shared-kernel/domain/event-recorder';
import type { RunId } from '@shared-kernel/domain/value-objects/run-id.vo';
import type { UserId } from '@shared-kernel/domain/value-objects/user-id.vo';
import type { WorkspaceId } from '@shared-kernel/domain/value-objects/workspace-id.vo';

const FINGERPRINT = /^[0-9a-f]{64}$/;

export const MOST_SEEN_KEPT = 64_000;

const LEEWAY = 1e-9;

interface ScoreState {
  readonly id: ScoreId;
  readonly runId: RunId;
  readonly workspaceId: WorkspaceId;
  readonly place: RunPlace;
  readonly fingerprint: string | null;
  readonly source: ScoreSource;
  readonly scale: ScoreScale;
  readonly value: number;
  readonly marks: readonly boolean[] | null;
  readonly rubricVersion: string | null;
  readonly model: string | null;
  readonly reasons: readonly JudgeReason[];
  readonly seen: SeenEvidence;
  readonly by: UserId | null;
  readonly at: Date;
  readonly version: number;
}

const markedClaims = (state: ScoreState): boolean => {
  const { marks } = state;

  if (!state.scale.byClaims) {
    return marks === null && state.reasons.every((each) => each.claim === null);
  }
  if (marks === null || marks.length === 0) {
    return false;
  }
  if (Math.abs(shareMet(marks) - state.value) > LEEWAY) {
    return false;
  }

  return (
    state.source !== 'judge' ||
    (state.reasons.every(
      (each) => each.claim !== null && each.claim < marks.length,
    ) &&
      marks.every((_, at) => state.reasons.some((each) => each.claim === at)))
  );
};

const checked = (state: ScoreState): ScoreState => {
  if (!state.scale.holds(state.value)) {
    throw new InvalidScoreError(
      `of ${state.value} is not on its ${state.scale.kind} scale`,
    );
  }
  if (!markedClaims(state)) {
    throw new InvalidScoreError(
      'marks each claim met or not, with a reason for each from the judge, when, and only when, it is on a claims scale',
    );
  }
  if (state.fingerprint !== null && !FINGERPRINT.test(state.fingerprint)) {
    throw new InvalidScoreError(
      'names its run’s station config by a 64-character hex fingerprint',
    );
  }
  if (state.rubricVersion !== null && !isRubricVersion(state.rubricVersion)) {
    throw new InvalidScoreError(
      'names its rubric by a 64-character hex digest',
    );
  }

  if (state.source === 'judge') {
    if (state.rubricVersion === null || !state.model?.trim()) {
      throw new InvalidScoreError(
        'from the judge names the rubric and the model it was judged by',
      );
    }
    if (state.reasons.length === 0 || state.by !== null) {
      throw new InvalidScoreError(
        'from the judge gives its reasons, and is given by nobody',
      );
    }
    if (
      state.seen.size > MOST_SEEN_KEPT ||
      !state.seen.onlyCitedBy(state.reasons.flatMap((each) => each.citations))
    ) {
      throw new InvalidScoreError(
        `from the judge keeps only what its reasons cite, in at most ${MOST_SEEN_KEPT} characters`,
      );
    }
  } else if (
    state.by === null ||
    state.model !== null ||
    state.reasons.length > 0 ||
    !state.seen.isEmpty
  ) {
    throw new InvalidScoreError(
      'from a person names who gave it, and neither a model nor reasons',
    );
  }

  return state;
};

export class Score extends EventRecorder {
  private constructor(private readonly state: ScoreState) {
    super();
  }

  static judged(input: {
    id: ScoreId;
    runId: RunId;
    workspaceId: WorkspaceId;
    place: RunPlace;
    fingerprint: string | null;
    scale: ScoreScale;
    value: number;
    marks: readonly boolean[] | null;
    rubricVersion: string;
    model: string;
    reasons: readonly JudgeReason[];
    seen: SeenEvidence;
    at: Date;
  }): Score {
    const judged = new Score(
      checked({
        ...input,
        seen: input.seen
          .citedBy(input.reasons.flatMap((each) => each.citations))
          .within(MOST_SEEN_KEPT),
        source: 'judge',
        by: null,
        version: 0,
      }),
    );
    judged.record(
      new ScoreRecorded(input.id, input.runId, input.place, 'judge'),
    );
    return judged;
  }

  static graded(input: {
    id: ScoreId;
    runId: RunId;
    workspaceId: WorkspaceId;
    place: RunPlace;
    fingerprint: string | null;
    scale: ScoreScale;
    value: number;
    marks: readonly boolean[] | null;
    rubricVersion: string | null;
    by: UserId;
    at: Date;
  }): Score {
    const graded = new Score(
      checked({
        ...input,
        source: 'person',
        model: null,
        reasons: [],
        seen: SeenEvidence.none(),
        version: 0,
      }),
    );
    graded.record(
      new ScoreRecorded(input.id, input.runId, input.place, 'person'),
    );
    return graded;
  }

  static rehydrate(state: ScoreState): Score {
    return new Score(checked(state));
  }

  get id(): ScoreId {
    return this.state.id;
  }

  get runId(): RunId {
    return this.state.runId;
  }

  get workspaceId(): WorkspaceId {
    return this.state.workspaceId;
  }

  get place(): RunPlace {
    return this.state.place;
  }

  get fingerprint(): string | null {
    return this.state.fingerprint;
  }

  get source(): ScoreSource {
    return this.state.source;
  }

  get scale(): ScoreScale {
    return this.state.scale;
  }

  get value(): number {
    return this.state.value;
  }

  get marks(): readonly boolean[] | null {
    return this.state.marks;
  }

  get rubricVersion(): string | null {
    return this.state.rubricVersion;
  }

  get model(): string | null {
    return this.state.model;
  }

  get reasons(): readonly JudgeReason[] {
    return this.state.reasons;
  }

  get seen(): SeenEvidence {
    return this.state.seen;
  }

  get by(): UserId | null {
    return this.state.by;
  }

  get at(): Date {
    return this.state.at;
  }

  get version(): number {
    return this.state.version;
  }

  get fromJudge(): boolean {
    return this.state.source === 'judge';
  }

  regraded(input: {
    scale: ScoreScale;
    value: number;
    marks: readonly boolean[] | null;
    rubricVersion: string | null;
    at: Date;
  }): Score {
    if (this.fromJudge) {
      throw new InvalidScoreError('from the judge is never graded again');
    }

    if (
      this.state.scale.equals(input.scale) &&
      this.state.value === input.value &&
      JSON.stringify(this.state.marks) === JSON.stringify(input.marks) &&
      this.state.rubricVersion === input.rubricVersion
    ) {
      return this;
    }

    const regraded = new Score(checked({ ...this.state, ...input }));
    regraded.record(
      new ScoreRecorded(this.id, this.runId, this.place, 'person'),
    );
    return regraded;
  }
}
