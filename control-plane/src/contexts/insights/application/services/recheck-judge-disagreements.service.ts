import type {
  LiveJudgedRun,
  StationFactsPort,
} from '@insights/application/ports/station-facts.port';
import type {
  RaiseJudgeDisagreements,
  Reconsidered,
} from '@insights/application/services/raise-judge-disagreements.service';
import type { JudgeDisagreementRepository } from '@insights/domain/repositories/judge-disagreement.repository';
import type { JudgeDisagreementId } from '@insights/domain/value-objects/judge-disagreement-id.vo';
import type { ClockPort } from '@shared-kernel/application/ports/clock.port';
import type { LoggerPort } from '@shared-kernel/application/ports/logger.port';
import type { PendingJobsPort } from '@shared-kernel/application/ports/pending-jobs.port';

const EVERY_MS = 6 * 60 * 60_000;

const JUDGED_WITHIN_MS = 30 * 24 * 60 * 60_000;

export const RECHECKED_AT_ONCE = 100;

const NAMED = 20;

type Pass =
  | { readonly kind: 'standing'; readonly after: JudgeDisagreementId | null }
  | { readonly kind: 'judged'; readonly after: LiveJudgedRun | null };

interface Sweep {
  readonly since: Date;
  readonly checked: Set<string>;
  pass: Pass;
}

export class RecheckJudgeDisagreements implements PendingJobsPort {
  readonly name = 'Checking judge disagreements against their runs again';

  #startedAt: number | null = null;

  #sweep: Sweep | null = null;

  constructor(
    private readonly raising: RaiseJudgeDisagreements,
    private readonly disagreements: JudgeDisagreementRepository,
    private readonly facts: StationFactsPort,
    private readonly clock: ClockPort,
    private readonly logger: LoggerPort,
  ) {}

  async processDue(): Promise<void> {
    const sweep = this.#sweep ?? this.started();

    if (!sweep) {
      return;
    }

    const { pass } = sweep;

    if (pass.kind === 'standing') {
      const page = await this.disagreements.standing(
        pass.after,
        RECHECKED_AT_ONCE,
      );
      await this.again(sweep, page);
      sweep.pass =
        page.length < RECHECKED_AT_ONCE
          ? { kind: 'judged', after: null }
          : { kind: 'standing', after: page[page.length - 1]?.id ?? null };
      return;
    }

    const page = await this.facts.liveJudgedSince({
      since: sweep.since,
      after: pass.after,
      max: RECHECKED_AT_ONCE,
    });
    await this.again(sweep, page);

    if (page.length < RECHECKED_AT_ONCE) {
      this.#sweep = null;
      return;
    }
    sweep.pass = { kind: 'judged', after: page[page.length - 1] ?? null };
  }

  private started(): Sweep | null {
    const now = this.clock.now().getTime();

    if (this.#startedAt !== null && now - this.#startedAt < EVERY_MS) {
      return null;
    }

    this.#startedAt = now;
    this.#sweep = {
      since: new Date(now - JUDGED_WITHIN_MS),
      checked: new Set(),
      pass: { kind: 'standing', after: null },
    };

    return this.#sweep;
  }

  private async again(
    sweep: Sweep,
    runs: readonly Reconsidered[],
  ): Promise<void> {
    const unchecked = runs.filter(
      (each) => !sweep.checked.has(each.runId.value),
    );

    for (const each of unchecked) {
      sweep.checked.add(each.runId.value);
    }

    const failed = await this.raising.reconsider(unchecked);

    if (failed.length > 0) {
      this.logger.error(
        {
          err: failed[0]?.error,
          failed: failed.length,
          runIds: failed.slice(0, NAMED).map((each) => each.runId.value),
        },
        'Some judge disagreements could not be checked again',
      );
    }
  }
}
