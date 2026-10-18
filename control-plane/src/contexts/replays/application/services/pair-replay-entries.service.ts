import type { InsightsPort } from '@replays/application/ports/insights.port';
import type { Replay } from '@replays/domain/aggregates/replay.aggregate';
import type { ReplayEntryConcluded } from '@replays/domain/events/replay-entry-concluded.event';
import { ReplayPairingRequested } from '@replays/domain/events/replay-pairing-requested.event';
import type { ReplayRepository } from '@replays/domain/repositories/replay.repository';
import type { ReplayId } from '@replays/domain/value-objects/replay-id.vo';
import type { TransactionPort } from '@shared-kernel/application/ports/transaction.port';
import type { DomainEvent } from '@shared-kernel/domain/events/domain-event';
import type { RunId } from '@shared-kernel/domain/value-objects/run-id.vo';

export class PairReplayEntries {
  constructor(
    private readonly replays: ReplayRepository,
    private readonly insights: InsightsPort,
    private readonly transaction: TransactionPort,
  ) {}

  async concluded(
    event: ReplayEntryConcluded,
  ): Promise<readonly DomainEvent[]> {
    const replay = await this.replays.find(event.replayId);
    const pairing = await this.replays.pairingWith(event.replayId);
    const due = [...(replay?.pairs ? [event.replayId] : []), ...pairing];

    return due.map(
      (each) => new ReplayPairingRequested(each, event.workspaceId),
    );
  }

  async requested(replayId: ReplayId): Promise<void> {
    const seen = await this.replays.find(replayId);

    if (!seen?.pairs || !seen.takesPairings) {
      return;
    }

    const accepted = await this.acceptedOf(seen);

    await this.transaction.inTransaction(async () => {
      const replay = await this.replays.find(replayId);
      const reference = replay?.pairwiseReferenceId
        ? await this.replays.find(replay.pairwiseReferenceId)
        : null;

      if (!replay || !reference) {
        return;
      }

      const paired = replay.pairAgainst(reference, (original) =>
        accepted.has(original.value),
      );

      if (paired !== replay) {
        await this.replays.save(paired);
      }
    });
  }

  private async acceptedOf(replay: Replay): Promise<ReadonlySet<string>> {
    const wanting: RunId[] = [];

    for (const each of replay.entries) {
      if (
        each.wantsPairing(replay.scoring) &&
        !wanting.some((run) => run.equals(each.original))
      ) {
        wanting.push(each.original);
      }
    }

    const accepted = new Set<string>();

    for (const original of wanting) {
      if (await this.insights.acceptedAfter(original)) {
        accepted.add(original.value);
      }
    }

    return accepted;
  }
}
