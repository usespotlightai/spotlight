import type { ReplayEntry } from '@replays/domain/entities/replay-entry.entity';
import type { Scoring } from '@replays/domain/services/entry-result';
import type { ReplayId } from '@replays/domain/value-objects/replay-id.vo';
import type { RunId } from '@shared-kernel/domain/value-objects/run-id.vo';

interface State {
  readonly id: ReplayId;
  readonly rubricVersion: string | null;
  readonly scoring: Scoring;
  readonly entries: readonly ReplayEntry[];
}

export class PairingReference {
  private constructor(private readonly state: State) {}

  static of(state: State): PairingReference {
    return new PairingReference({ ...state, entries: [...state.entries] });
  }

  get id(): ReplayId {
    return this.state.id;
  }

  get rubricVersion(): string | null {
    return this.state.rubricVersion;
  }

  get scoring(): Scoring {
    return this.state.scoring;
  }

  entryMatching(entry: {
    readonly original: RunId;
    readonly repeat: number;
  }): ReplayEntry | null {
    const repeats = this.state.entries.filter((each) =>
      each.original.equals(entry.original),
    );

    return (
      repeats.find((each) => each.repeat === entry.repeat) ??
      repeats.find((each) => each.repeat === 1) ??
      null
    );
  }
}
