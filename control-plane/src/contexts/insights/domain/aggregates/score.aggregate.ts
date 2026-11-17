import { ScoreRecorded } from '@insights/domain/events/score-recorded.event';
import { InvalidScoreError } from '@insights/domain/exceptions/invalid-score.error';
import { ConfigFingerprint } from '@insights/domain/value-objects/config-fingerprint.vo';
import type { JudgeReason } from '@insights/domain/value-objects/judge-reason.vo';
import { RubricVersion } from '@insights/domain/value-objects/rubric-version.vo';
import type { RunLocation } from '@insights/domain/value-objects/run-location.vo';
import type { ScoreId } from '@insights/domain/value-objects/score-id.vo';
import {
  LIVE,
  type ScoreOrigin,
} from '@insights/domain/value-objects/score-origin';
import { SeenEvidence } from '@insights/domain/value-objects/seen-evidence.vo';
import { EventRecorder } from '@shared-kernel/domain/event-recorder';
import {
  claimShareOf,
  isPassThreshold,
  passesAt,
} from '@shared-kernel/domain/value-objects/claim-share';
import type { RunId } from '@shared-kernel/domain/value-objects/run-id.vo';
import type { WorkspaceId } from '@shared-kernel/domain/value-objects/workspace-id.vo';

export const MAX_SEEN_CHARS = 64_000;

interface ScoreFields {
  readonly id: ScoreId;
  readonly runId: RunId;
  readonly workspaceId: WorkspaceId;
  readonly location: RunLocation;
  readonly fingerprint: string | null;
  readonly origin: ScoreOrigin;
  readonly claimResults: readonly boolean[];
  readonly passThreshold: number;
  readonly rubricVersion: string;
  readonly model: string;
  readonly reasons: readonly JudgeReason[];
  readonly seen: SeenEvidence;
  readonly at: Date;
  readonly version: number;
}

interface ScoreState extends Omit<
  ScoreFields,
  'fingerprint' | 'rubricVersion'
> {
  readonly fingerprint: ConfigFingerprint | null;
  readonly rubricVersion: RubricVersion;
}

const reasonsMarkEachClaim = (state: ScoreState): boolean =>
  state.reasons.every(
    (each) => each.claim !== null && each.claim < state.claimResults.length,
  ) &&
  state.claimResults.every((_, at) =>
    state.reasons.some((each) => each.claim === at),
  );

const checked = (fields: ScoreFields): ScoreState => {
  const state: ScoreState = {
    ...fields,
    claimResults: [...fields.claimResults],
    fingerprint: ConfigFingerprint.optional(fields.fingerprint),
    rubricVersion: RubricVersion.of(fields.rubricVersion),
  };

  if (state.claimResults.length === 0) {
    throw new InvalidScoreError('must mark each claim as met or not met');
  }
  if (!isPassThreshold(state.passThreshold)) {
    throw new InvalidScoreError('pass threshold must be above 0, up to 1');
  }

  if (!state.model.trim()) {
    throw new InvalidScoreError('must name its model');
  }
  if (state.reasons.length === 0 || !reasonsMarkEachClaim(state)) {
    throw new InvalidScoreError('must give a reason for each claim');
  }
  if (
    state.seen.size > MAX_SEEN_CHARS ||
    !state.seen.onlyCitedBy(state.reasons.flatMap((each) => each.citations))
  ) {
    throw new InvalidScoreError(
      `must store at most ${MAX_SEEN_CHARS} characters of cited evidence`,
    );
  }

  return state;
};

export class Score extends EventRecorder {
  private deleted = false;

  private constructor(private readonly state: ScoreState) {
    super();
  }

  static judge(input: {
    id: ScoreId;
    runId: RunId;
    workspaceId: WorkspaceId;
    location: RunLocation;
    fingerprint: string | null;
    claimResults: readonly boolean[];
    passThreshold: number;
    rubricVersion: string;
    model: string;
    reasons: readonly JudgeReason[];
    seen: SeenEvidence;
    at: Date;
    origin?: ScoreOrigin;
  }): Score {
    const origin = input.origin ?? LIVE;
    const judged = new Score(
      checked({
        ...input,
        seen: input.seen
          .citedBy(input.reasons.flatMap((each) => each.citations))
          .within(MAX_SEEN_CHARS),
        origin,
        version: 0,
      }),
    );
    judged.record(
      new ScoreRecorded(
        input.id,
        input.runId,
        input.workspaceId,
        input.location,
        origin,
      ),
    );
    return judged;
  }

  static rehydrate(state: ScoreFields): Score {
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

  get location(): RunLocation {
    return this.state.location;
  }

  get fingerprint(): ConfigFingerprint | null {
    return this.state.fingerprint;
  }

  get origin(): ScoreOrigin {
    return this.state.origin;
  }

  get value(): number {
    return claimShareOf(this.state.claimResults);
  }

  get claimResults(): readonly boolean[] {
    return this.state.claimResults;
  }

  get passThreshold(): number {
    return this.state.passThreshold;
  }

  get passes(): boolean {
    return passesAt(this.value, this.state.passThreshold);
  }

  get rubricVersion(): RubricVersion {
    return this.state.rubricVersion;
  }

  get model(): string {
    return this.state.model;
  }

  get reasons(): readonly JudgeReason[] {
    return this.state.reasons;
  }

  get seen(): SeenEvidence {
    return this.state.seen;
  }

  get at(): Date {
    return this.state.at;
  }

  get version(): number {
    return this.state.version;
  }

  get isDeleted(): boolean {
    return this.deleted;
  }

  delete(): Score {
    const deleted = new Score(this.state);
    deleted.inheritEvents(this);
    deleted.deleted = true;
    return deleted;
  }
}
