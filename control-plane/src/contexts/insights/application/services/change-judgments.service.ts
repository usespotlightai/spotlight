import { JudgingError } from '@insights/application/errors/judging.error';
import type {
  ChangeJudgment,
  ChangeJudgmentOrder,
  ChangeJudgmentsPort,
} from '@insights/application/ports/change-judgments.port';
import type { EvidencePort } from '@insights/application/ports/evidence.port';
import type { JudgePort } from '@insights/application/ports/judge.port';
import { groundedVerdict } from '@insights/domain/services/grounded-verdict';
import { guardedGuidanceOf } from '@insights/domain/services/guidance';
import { JudgeEvidence } from '@insights/domain/services/judge-evidence';
import type { JudgingFailureCode } from '@shared-kernel/domain/value-objects/judging-failure.vo';

const unjudged = (failure: JudgingFailureCode): ChangeJudgment => ({
  judged: false,
  failure,
});

export class ChangeJudgments implements ChangeJudgmentsPort {
  constructor(
    private readonly evidence: EvidencePort,
    private readonly llmJudge: JudgePort,
  ) {}

  get available(): boolean {
    return this.llmJudge.available;
  }

  async judge(order: ChangeJudgmentOrder): Promise<ChangeJudgment> {
    if (!this.llmJudge.available) {
      return unjudged('unavailable');
    }

    const [run, reference] = await Promise.all([
      this.evidence.of(order.runId),
      order.reference ? this.evidence.of(order.reference) : null,
    ]);

    if (!run) {
      return unjudged('no-evidence');
    }

    const own = JudgeEvidence.of({
      runId: order.runId,
      title: run.title,
      description: run.description,
      steps: run.steps,
      hunks: run.hunks,
    });
    const evidence = reference ? own.against(reference.hunks) : own;

    if (evidence.isEmpty) {
      return unjudged('no-evidence');
    }

    try {
      const answer = await this.llmJudge.judge({
        rubric: order.criteria.rubric,
        claims: order.criteria.claims,
        scale: order.criteria.scale.kind,
        title: evidence.title,
        description: evidence.description,
        steps: evidence.steps,
        stepsLeftOut: evidence.stepsLeftOut,
        hunks: evidence.hunks,
        hunksLeftOut: evidence.hunksLeftOut,
        reference: evidence.reference,
        guidanceRequested: order.guidanceRequested,
        replayed: true,
      });
      const grounded = groundedVerdict(
        order.criteria,
        answer.verdict,
        evidence,
      );

      if (!grounded.grounded) {
        return unjudged(grounded.failure);
      }

      return {
        judged: true,
        value: grounded.value,
        claimResults: grounded.claimResults,
        reasons: grounded.reasons.map((reason) => ({
          text: reason.text,
          steps: reason.citations.flatMap((each) =>
            each.step === null ? [] : [each.step],
          ),
          hunks: reason.citations.flatMap((each) =>
            each.hunk === null ? [] : [each.hunk],
          ),
          claim: reason.claim,
        })),
        guidance: order.guidanceRequested
          ? guardedGuidanceOf(answer.guidance, order.criteria)
          : null,
        referenced: evidence.reference !== null,
        model: answer.model,
      };
    } catch (error) {
      if (error instanceof JudgingError) {
        return unjudged(error.kind);
      }
      throw error;
    }
  }
}
