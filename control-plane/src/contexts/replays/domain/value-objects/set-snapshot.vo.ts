import type { ReplayedStation } from '@replays/domain/aggregates/replay-set.aggregate';
import { ReplaySetStationGoneError } from '@replays/domain/exceptions/replay-set-station-gone.error';
import type { ReplaySetEntry } from '@replays/domain/value-objects/replay-set-entry.vo';
import type { ReplaySetId } from '@replays/domain/value-objects/replay-set-id.vo';
import type { RunId } from '@shared-kernel/domain/value-objects/run-id.vo';
import type { TeamId } from '@shared-kernel/domain/value-objects/team-id.vo';
import type { WorkspaceId } from '@shared-kernel/domain/value-objects/workspace-id.vo';

interface State {
  readonly id: ReplaySetId;
  readonly station: ReplayedStation;
  readonly entries: readonly ReplaySetEntry[];
  readonly isAtGoneStation: boolean;
}

export class SetSnapshot {
  private constructor(private readonly state: State) {}

  static of(input: State): SetSnapshot {
    return new SetSnapshot({ ...input, entries: [...input.entries] });
  }

  get id(): ReplaySetId {
    return this.state.id;
  }

  get station(): ReplayedStation {
    return this.state.station;
  }

  get entries(): readonly ReplaySetEntry[] {
    return this.state.entries;
  }

  get isAtGoneStation(): boolean {
    return this.state.isAtGoneStation;
  }

  get workspaceId(): WorkspaceId {
    return this.station.workspaceId;
  }

  get teamId(): TeamId {
    return this.station.teamId;
  }

  get runs(): readonly RunId[] {
    return this.entries.map((each) => each.runId);
  }

  includes(run: RunId): boolean {
    return this.entries.some((each) => each.runId.equals(run));
  }

  stillAtItsStation(): void {
    if (this.isAtGoneStation) {
      throw new ReplaySetStationGoneError(this.id.value);
    }
  }
}
