import type {
  ChangeJudgment,
  ChangeJudgmentOrder,
  ChangeJudgmentRound,
  ChangeJudgmentsPort,
} from '@insights/application/ports/change-judgments.port';
import type { EvidencePort } from '@insights/application/ports/evidence.port';
import type { JudgePort } from '@insights/application/ports/judge.port';
import type {
  SessionWaiting,
  SettledSession,
} from '@insights/application/ports/session-outcomes';
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
    private readonly judging: JudgePort,
  ) {}

  async judge(
    order: ChangeJudgmentOrder,
  ): Promise<ChangeJudgment | SessionWaiting> {
    const { runId } = order.round;
    const [run, reference] = await Promise.all([
      this.evidence.of(runId),
      order.reference ? this.evidence.of(order.reference) : null,
    ]);

    if (!run) {
      return unjudged('no-evidence');
    }

    const own = JudgeEvidence.of({
      runId,
      title: run.title,
      description: run.description,
      steps: run.steps,
      hunks: run.hunks,
    });
    const evidence = reference ? own.against(reference.hunks) : own;

    if (evidence.isEmpty) {
      return unjudged('no-evidence');
    }

    const answer = await this.judging.judge({
      workspaceId: order.workspaceId,
      round: { of: 'change', round: order.round },
      claims: order.criteria.claims,
      title: evidence.title,
      description: evidence.description,
      steps: evidence.steps,
      stepsLeftOut: evidence.stepsLeftOut,
      hunks: evidence.hunks,
      hunksLeftOut: evidence.hunksLeftOut,
      reference: evidence.reference,
      guidanceRequested: order.guidanceRequested,
      effectsBlocked: order.effectsBlocked,
      blockedTools: run.blockedTools,
    });

    if (answer.status === 'waiting') {
      return answer;
    }
    if (answer.status === 'failed') {
      return unjudged(answer.failure);
    }

    const grounded = groundedVerdict(order.criteria, answer.verdict, evidence);

    if (!grounded.grounded) {
      return unjudged(grounded.failure);
    }

    return {
      judged: true,
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
  }

  roundOf(session: SettledSession): ChangeJudgmentRound | null {
    const round = this.judging.roundOf(session);

    return round?.of === 'change' ? round.round : null;
  }
}
