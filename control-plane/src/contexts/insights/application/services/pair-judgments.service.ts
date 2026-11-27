import type { EvidencePort } from '@insights/application/ports/evidence.port';
import type {
  PairJudgment,
  PairJudgmentOrder,
  PairJudgmentOrderKind,
  PairJudgmentRound,
  PairJudgmentsPort,
} from '@insights/application/ports/pair-judgments.port';
import {
  allSettled,
  type SessionWaiting,
  type SettledSession,
} from '@insights/application/ports/session-outcomes';
import type { SideBySideJudgePort } from '@insights/application/ports/side-by-side-judge.port';
import { groundedPair } from '@insights/domain/services/grounded-pair';
import { PairEvidence } from '@insights/domain/services/pair-evidence';
import type { PairOrder } from '@insights/domain/value-objects/pair-order';
import { itemAt } from '@shared-kernel/domain/item-at';
import type { JudgingFailureCode } from '@shared-kernel/domain/value-objects/judging-failure.vo';

const ORDER_OF: Readonly<Record<PairJudgmentOrderKind, PairOrder>> = {
  'run-first': 'run-first',
  'other-first': 'other-first',
};

const unjudged = (failure: JudgingFailureCode): PairJudgment => ({
  judged: false,
  failure,
});

export class PairJudgments implements PairJudgmentsPort {
  constructor(
    private readonly evidence: EvidencePort,
    private readonly judging: SideBySideJudgePort,
  ) {}

  async judge(
    order: PairJudgmentOrder,
  ): Promise<PairJudgment | SessionWaiting> {
    const { runId, otherRunId } = order.round;
    const [run, other, reference] = await Promise.all([
      this.evidence.of(runId),
      this.evidence.of(otherRunId),
      this.evidence.of(order.reference),
    ]);

    if (!run || !other || !reference) {
      return unjudged('no-evidence');
    }

    const shown = order.orders.flatMap((pass) => {
      const evidence = PairEvidence.of({
        run: { run: runId, hunks: run.hunks },
        other: { run: otherRunId, hunks: other.hunks },
        order: ORDER_OF[pass],
        title: run.title,
        description: run.description,
        reference: reference.hunks,
      });

      return evidence.reference && !evidence.isEmpty
        ? [{ pass, evidence, reference: evidence.reference }]
        : [];
    });

    if (shown.length === 0 || shown.length !== order.orders.length) {
      return unjudged('no-evidence');
    }

    const judged = allSettled(
      await Promise.all(
        shown.map(({ pass, evidence, reference: shownReference }) =>
          this.judging.judgePair({
            workspaceId: order.workspaceId,
            round: order.round,
            pass,
            claims: order.criteria.claims,
            title: evidence.title,
            description: evidence.description,
            a: evidence.a,
            b: evidence.b,
            reference: shownReference,
          }),
        ),
      ),
    );

    if ('status' in judged) {
      return judged;
    }

    const failed = judged.find((each) => each.status === 'failed');

    if (failed?.status === 'failed') {
      return unjudged(failed.failure);
    }

    const passes = judged.flatMap((each, at) => {
      const seen = itemAt(shown, at);

      return each.status === 'judged' && seen !== undefined
        ? [{ verdict: each.verdict, evidence: seen.evidence }]
        : [];
    });
    const model = judged.find((each) => each.status === 'judged')?.model;
    const grounded = groundedPair(passes);

    if (model === undefined) {
      return unjudged('no-evidence');
    }
    if (!grounded.grounded) {
      return unjudged(grounded.failure);
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
    };
  }

  roundOf(session: SettledSession): PairJudgmentRound | null {
    return this.judging.roundOf(session);
  }
}
