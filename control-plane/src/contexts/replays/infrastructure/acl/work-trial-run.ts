import type { OrderedTrial } from '@replays/application/ports/station-trials.port';
import type { MovesOnWords } from '@replays/domain/value-objects/moves-on-words.vo';
import type { StationFingerprint } from '@replays/domain/value-objects/station-fingerprint.vo';
import type {
  TrialCheckout,
  TrialOrder,
} from '@work/application/ports/station-trials.port';

export class WorkTrialRun implements OrderedTrial {
  constructor(
    readonly order: TrialOrder,
    readonly checkouts: readonly TrialCheckout[],
    readonly fingerprint: StationFingerprint | null,
    readonly movesOnAfter: MovesOnWords,
  ) {}
}
