import type { OutcomesPort } from '@replays/application/ports/outcomes.port';
import type { WorkPort } from '@replays/application/ports/work.port';
import { Candidate } from '@replays/domain/aggregates/candidate.aggregate';
import { Replay } from '@replays/domain/aggregates/replay.aggregate';
import type { ReplaySet } from '@replays/domain/aggregates/replay-set.aggregate';
import type { ReplayEnded } from '@replays/domain/events/replay-ended.event';
import type { CandidateRepository } from '@replays/domain/repositories/candidate.repository';
import type { ReplayRepository } from '@replays/domain/repositories/replay.repository';
import type { ReplaySetRepository } from '@replays/domain/repositories/replay-set.repository';
import {
  type OracleAnswered,
  oracleAnswerOf,
} from '@replays/domain/services/oracle-answer';
import { CandidateId } from '@replays/domain/value-objects/candidate-id.vo';
import { ReplayId } from '@replays/domain/value-objects/replay-id.vo';
import type { ReplayState } from '@replays/domain/value-objects/replay-state';
import type { StationFingerprint } from '@replays/domain/value-objects/station-fingerprint.vo';
import type { ClockPort } from '@shared-kernel/application/ports/clock.port';
import type { IdGeneratorPort } from '@shared-kernel/application/ports/id-generator.port';
import type { TransactionPort } from '@shared-kernel/application/ports/transaction.port';
import { Attribution } from '@shared-kernel/domain/value-objects/attribution.vo';
import type { RunId } from '@shared-kernel/domain/value-objects/run-id.vo';

const STANDING: readonly ReplayState[] = ['queued', 'running', 'finished'];

export class StartOracleReplay {
  constructor(
    private readonly sets: ReplaySetRepository,
    private readonly replays: ReplayRepository,
    private readonly candidates: CandidateRepository,
    private readonly work: WorkPort,
    private readonly outcomes: OutcomesPort,
    private readonly ids: IdGeneratorPort,
    private readonly clock: ClockPort,
    private readonly transaction: TransactionPort,
  ) {}

  async baselineEnded(event: ReplayEnded): Promise<void> {
    if (event.state !== 'finished' || event.searchId !== null) {
      return;
    }

    const baseline = await this.replays.find(event.replayId);
    const live = baseline && (await this.candidates.find(baseline.candidateId));

    if (
      !baseline ||
      !live?.isLive ||
      baseline.among !== null ||
      baseline.searchId !== null
    ) {
      return;
    }

    if (!(await this.stillLive(baseline, live.fingerprint))) {
      return;
    }

    const set = await this.sets.find(baseline.setId);
    const answered = set && (await this.answeredIn(set, baseline.originals));

    if (!set || set.isAtGoneStation || !answered?.length) {
      return;
    }

    const oracle = Candidate.oracleOf(live, {
      id: CandidateId.of(this.ids.generate()),
      at: this.clock.now(),
    });

    await this.transaction.inTransaction(async () => {
      const locked = await this.sets.locked(set.id);
      const against = await this.replays.find(baseline.id);
      const answers = locked
        ? answered.filter((each) => locked.holds(each.run))
        : [];

      if (
        !locked ||
        !against ||
        locked.isAtGoneStation ||
        answers.length === 0 ||
        (await this.hasOracle(locked, live.fingerprint)) ||
        !(await this.stillLive(baseline, live.fingerprint))
      ) {
        return;
      }

      await this.candidates.add(oracle);
      await this.replays.add(
        Replay.start({
          id: ReplayId.of(this.ids.generate()),
          set: locked,
          candidate: oracle,
          baseline: false,
          ceiling: baseline.ceiling,
          repeats: baseline.repeats,
          oracle: { answers, against, live },
          ...(baseline.unpricedRate
            ? { unpricedRate: baseline.unpricedRate }
            : {}),
          at: oracle.createdAt,
          by: Attribution.spotlight(locked.workspaceId),
        }),
      );
    });
  }

  private async stillLive(
    baseline: Replay,
    fingerprint: StationFingerprint,
  ): Promise<boolean> {
    const current = await this.work.live(
      baseline.station.lineId,
      baseline.station.stationId,
    );

    return current?.fingerprint.equals(fingerprint) ?? false;
  }

  private async answeredIn(
    set: ReplaySet,
    replayed: readonly RunId[],
  ): Promise<readonly OracleAnswered[]> {
    const runs = set.entries
      .map((each) => each.runId)
      .filter((run) => replayed.some((each) => each.equals(run)));
    const turned = await this.outcomes.turnedOut(runs);
    const asked = runs.flatMap((run) => {
      const answer = oracleAnswerOf(turned.get(run.value));

      return answer ? [{ run, answer }] : [];
    });
    const answerable = await this.work.answerable(asked);

    return asked.filter((each) =>
      answerable.some((run) => run.equals(each.run)),
    );
  }

  private async hasOracle(
    set: ReplaySet,
    fingerprint: StationFingerprint,
  ): Promise<boolean> {
    const standing = (await this.replays.ofSet(set.id)).filter((each) =>
      STANDING.includes(each.current),
    );
    const configs = await this.candidates.findMany(
      standing.map((each) => each.candidateId),
    );

    return configs.some(
      (each) => each.isOracle && each.basedOn.equals(fingerprint),
    );
  }
}
