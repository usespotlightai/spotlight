import { InvalidReplayError } from '@replays/domain/exceptions/invalid-replay.error';
import { judgeGuidanceOf } from '@shared-kernel/domain/value-objects/judge-guidance';
import {
  isJudgeScaleKind,
  JudgeScale,
  type JudgeScaleKind,
} from '@shared-kernel/domain/value-objects/judge-scale.vo';

export interface CitedReason {
  readonly text: string;
  readonly steps: readonly number[];
  readonly hunks: readonly string[];
  readonly claim: number | null;
}

const isRate = (value: number): boolean =>
  Number.isFinite(value) && value >= 0 && value <= 1;

export class JudgeVerdict {
  private constructor(
    readonly scale: JudgeScaleKind,
    readonly value: number,
    readonly claimResults: readonly boolean[] | null,
    readonly claims: readonly string[],
    readonly passThreshold: number,
    readonly model: string,
    readonly referenced: boolean,
    readonly reasons: readonly CitedReason[],
    readonly guidance: string | null,
  ) {}

  static of(input: {
    scale: string;
    value: number;
    claimResults: readonly boolean[] | null;
    claims: readonly string[];
    passThreshold: number;
    model: string;
    referenced: boolean;
    reasons: readonly CitedReason[];
    guidance: string | null;
  }): JudgeVerdict {
    const { claimResults, passThreshold } = input;

    if (!isJudgeScaleKind(input.scale)) {
      throw new InvalidReplayError(
        `judge must score yes or no, 1 to 5, or by claims, not ${input.scale}`,
      );
    }

    const scale = JudgeScale.of(input.scale);

    if (!scale.includes(input.value)) {
      throw new InvalidReplayError(
        `judge score ${input.value} is not on the ${input.scale} scale`,
      );
    }
    if (!scale.marks(input.value, claimResults)) {
      throw new InvalidReplayError(
        'judge must mark claims only when it judges by claims',
      );
    }
    if ((claimResults?.length ?? 0) !== input.claims.length) {
      throw new InvalidReplayError(
        'judge must name exactly the claims it marks',
      );
    }
    if (!isRate(passThreshold)) {
      throw new InvalidReplayError('judge pass threshold must be from 0 to 1');
    }

    return new JudgeVerdict(
      input.scale,
      input.value,
      claimResults && [...claimResults],
      [...input.claims],
      passThreshold,
      input.model,
      input.referenced,
      input.reasons.map((each) => ({
        text: each.text,
        steps: [...each.steps],
        hunks: [...each.hunks],
        claim: each.claim,
      })),
      scale.passes(input.value, passThreshold)
        ? null
        : judgeGuidanceOf(input.guidance),
    );
  }

  get passes(): boolean {
    return JudgeScale.of(this.scale).passes(this.value, this.passThreshold);
  }

  equals(other: JudgeVerdict): boolean {
    return (
      this.scale === other.scale &&
      this.value === other.value &&
      JSON.stringify(this.claimResults) ===
        JSON.stringify(other.claimResults) &&
      JSON.stringify(this.claims) === JSON.stringify(other.claims) &&
      this.passThreshold === other.passThreshold &&
      this.model === other.model &&
      this.referenced === other.referenced &&
      JSON.stringify(this.reasons) === JSON.stringify(other.reasons) &&
      this.guidance === other.guidance
    );
  }
}
