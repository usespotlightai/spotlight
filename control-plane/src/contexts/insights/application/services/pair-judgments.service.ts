import { JudgingError } from '@insights/application/errors/judging.error';
import type { EvidencePort } from '@insights/application/ports/evidence.port';
import type {
  PairJudgment,
  PairJudgmentOrder,
  PairJudgmentsPort,
} from '@insights/application/ports/pair-judgments.port';
import type { SideBySideJudgePort } from '@insights/application/ports/side-by-side-judge.port';
import {
  groundedPair,
  type PairShown,
} from '@insights/domain/services/grounded-pair';
import { PairEvidence } from '@insights/domain/services/pair-evidence';
import type { JudgingFailureCode } from '@shared-kernel/domain/value-objects/judging-failure.vo';
import { ModelUsage } from '@shared-kernel/domain/value-objects/model-usage.vo';

const unjudged = (
  failure: JudgingFailureCode,
  spent = ModelUsage.none(),
): PairJudgment => ({ judged: false, failure, spent });

export class PairJudgments implements PairJudgmentsPort {
  constructor(
    private readonly evidence: EvidencePort,
    private readonly llmJudge: SideBySideJudgePort,
  ) {}

  get available(): boolean {
    return this.llmJudge.available;
  }

  async judge(order: PairJudgmentOrder): Promise<PairJudgment> {
    if (!this.llmJudge.available) {
      return unjudged('unavailable');
    }

    const [run, other, reference] = await Promise.all([
      this.evidence.of(order.runId.value),
      this.evidence.of(order.otherRunId.value),
      this.evidence.of(order.reference.value),
    ]);

    if (!run || !other || !reference) {
      return unjudged('no-evidence');
    }

    const shown = order.orders.map((each) =>
      PairEvidence.of({
        run: { run: order.runId, hunks: run.hunks },
        other: { run: order.otherRunId, hunks: other.hunks },
        order: each,
        title: run.title,
        description: run.description,
        reference: reference.hunks,
      }),
    );

    if (shown.length === 0 || shown.some((each) => each.isEmpty)) {
      return unjudged('no-evidence');
    }

    let spent = ModelUsage.none();
    const passes: PairShown[] = [];
    const models: string[] = [];

    try {
      for (const evidence of shown) {
        const { reference: shownReference } = evidence;

        if (!shownReference) {
          return unjudged('no-evidence', spent);
        }

        const { verdict, usage, model } = await this.llmJudge.judgePair({
          rubric: order.criteria.rubric,
          claims: order.criteria.claims,
          title: evidence.title,
          description: evidence.description,
          a: evidence.a,
          b: evidence.b,
          reference: shownReference,
        });

        spent = spent.with(usage);
        passes.push({ verdict, evidence });
        models.push(model);
      }
    } catch (error) {
      return error instanceof JudgingError
        ? unjudged(error.kind, spent.with(error.usage))
        : unjudged('errored', spent);
    }

    const [model] = models;
    const grounded = groundedPair(passes);

    if (model === undefined) {
      return unjudged('no-evidence', spent);
    }
    if (!grounded.grounded) {
      return unjudged(grounded.failure, spent);
    }

    return {
      judged: true,
      passes: grounded.passes.map((pass) => ({
        order: pass.runShownFirst ? 'run-first' : 'other-first',
        winner: pass.winner,
        reasons: pass.reasons.map((each) => ({
          text: each.text,
          runHunks: [...each.runHunks],
          otherHunks: [...each.otherHunks],
        })),
      })),
      model,
      spent,
    };
  }
}
