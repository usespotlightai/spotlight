import { ReplaySetDeleted } from '@replays/domain/events/replay-set-deleted.event';
import { ReplaySetEntriesChanged } from '@replays/domain/events/replay-set-entries-changed.event';
import { ReplaySetGuardChanged } from '@replays/domain/events/replay-set-guard-changed.event';
import { ReplaySetStationGone } from '@replays/domain/events/replay-set-station-gone.event';
import { ChangesGuardedElsewhereError } from '@replays/domain/exceptions/changes-guarded-elsewhere.error';
import { ReplaySetEntryElsewhereError } from '@replays/domain/exceptions/replay-set-entry-elsewhere.error';
import { ReplaySetEntryTakenError } from '@replays/domain/exceptions/replay-set-entry-taken.error';
import { ReplaySetFullError } from '@replays/domain/exceptions/replay-set-full.error';
import { ReplaySetStationGoneError } from '@replays/domain/exceptions/replay-set-station-gone.error';
import { ReplaySetUnderwayError } from '@replays/domain/exceptions/replay-set-underway.error';
import { UnknownReplaySetEntryError } from '@replays/domain/exceptions/unknown-replay-set-entry.error';
import { UnreplayableEntryError } from '@replays/domain/exceptions/unreplayable-entry.error';
import { ChangesGuardDetail } from '@replays/domain/value-objects/changes-guard-detail.vo';
import type { ReplayRefusal } from '@replays/domain/value-objects/replay-refusal';
import { ReplaySetEntry } from '@replays/domain/value-objects/replay-set-entry.vo';
import type { ReplaySetId } from '@replays/domain/value-objects/replay-set-id.vo';
import type { ReplaySetName } from '@replays/domain/value-objects/replay-set-name.vo';
import { EventRecorder } from '@shared-kernel/domain/event-recorder';
import type { Attribution } from '@shared-kernel/domain/value-objects/attribution.vo';
import { ConfigurationChange } from '@shared-kernel/domain/value-objects/configuration-change.vo';
import type { RunId } from '@shared-kernel/domain/value-objects/run-id.vo';
import type { TaskId } from '@shared-kernel/domain/value-objects/task-id.vo';
import type { TeamId } from '@shared-kernel/domain/value-objects/team-id.vo';
import type { WorkspaceId } from '@shared-kernel/domain/value-objects/workspace-id.vo';

export const MAX_SET_ENTRIES = 50;

export interface ReplayedStation {
  readonly workspaceId: WorkspaceId;
  readonly teamId: TeamId;
  readonly lineId: string;
  readonly stationId: string;
}

export interface Replayable {
  readonly runId: RunId;
  readonly taskId: TaskId | null;
  readonly stationId: string | null;
  readonly refusal: ReplayRefusal | null;
  readonly reason: string | null;
}

interface State {
  readonly id: ReplaySetId;
  readonly station: ReplayedStation;
  readonly name: ReplaySetName;
  readonly entries: readonly ReplaySetEntry[];
  readonly guardsChanges: boolean;
  readonly createdAt: Date;
  readonly stationGoneAt: Date | null;
  readonly version: number;
}

const HOLDER = 'replay-set';

export class ReplaySet extends EventRecorder {
  private constructor(
    private readonly state: State,
    readonly isDeleted: boolean,
  ) {
    super();
  }

  static open(input: {
    id: ReplaySetId;
    station: ReplayedStation;
    name: ReplaySetName;
    at: Date;
  }): ReplaySet {
    return new ReplaySet(
      {
        id: input.id,
        station: input.station,
        name: input.name,
        entries: [],
        guardsChanges: false,
        createdAt: input.at,
        stationGoneAt: null,
        version: 0,
      },
      false,
    );
  }

  static rehydrate(state: State): ReplaySet {
    return new ReplaySet(state, false);
  }

  get id(): ReplaySetId {
    return this.state.id;
  }

  get station(): ReplayedStation {
    return this.state.station;
  }

  get workspaceId(): WorkspaceId {
    return this.state.station.workspaceId;
  }

  get teamId(): TeamId {
    return this.state.station.teamId;
  }

  get name(): ReplaySetName {
    return this.state.name;
  }

  get entries(): readonly ReplaySetEntry[] {
    return this.state.entries;
  }

  get runs(): readonly RunId[] {
    return this.state.entries.map((each) => each.runId);
  }

  get guardsChanges(): boolean {
    return this.state.guardsChanges;
  }

  get createdAt(): Date {
    return this.state.createdAt;
  }

  get stationGoneAt(): Date | null {
    return this.state.stationGoneAt;
  }

  get isAtGoneStation(): boolean {
    return this.state.stationGoneAt !== null;
  }

  get version(): number {
    return this.state.version;
  }

  static holderOf(id: ReplaySetId): string {
    return `${HOLDER}:${id.value}`;
  }

  get holder(): string {
    return ReplaySet.holderOf(this.state.id);
  }

  includes(run: RunId): boolean {
    return this.state.entries.some((each) => each.runId.equals(run));
  }

  isAtStation(stationId: string): boolean {
    return this.state.station.stationId === stationId;
  }

  rename(name: ReplaySetName): ReplaySet {
    return name.equals(this.state.name) ? this : this.with({ name });
  }

  stationLeft(at: Date): ReplaySet {
    if (this.isAtGoneStation) {
      return this;
    }

    const left = this.with({ stationGoneAt: at });

    left.record(new ReplaySetStationGone(this.id, this.workspaceId));

    return left;
  }

  stillAtItsStation(): void {
    if (this.isAtGoneStation) {
      throw new ReplaySetStationGoneError(this.id.value);
    }
  }

  recordSearch(): ReplaySet {
    this.stillAtItsStation();

    return this.with({});
  }

  guardingChanges(atStation: readonly ReplaySet[], by: Attribution): ReplaySet {
    this.stillAtItsStation();

    const checking = atStation.find(
      (each) =>
        each.guardsChanges &&
        !each.id.equals(this.id) &&
        each.isAtStation(this.state.station.stationId),
    );

    if (checking) {
      throw new ChangesGuardedElsewhereError(this.state.station.stationId);
    }

    return this.guarding(true, by);
  }

  notGuardingChanges(by: Attribution): ReplaySet {
    return this.guarding(false, by);
  }

  private guarding(guardsChanges: boolean, by: Attribution): ReplaySet {
    if (this.state.guardsChanges === guardsChanges) {
      return this;
    }

    const changed = this.with({ guardsChanges });

    changed.record(
      new ReplaySetGuardChanged(
        this.id,
        this.teamId,
        ConfigurationChange.updated(
          {
            resource: 'replay-set',
            id: this.id.value,
            key: this.state.name.value,
          },
          by,
          ChangesGuardDetail.of(guardsChanges),
        ),
      ),
    );

    return changed;
  }

  withEntry(replayable: Replayable, at: Date, searched: boolean): ReplaySet {
    const run = replayable.runId;

    this.stillAtItsStation();
    this.unsearched(searched);

    if (this.includes(run)) {
      throw new ReplaySetEntryTakenError(run.value);
    }

    if (this.state.entries.length >= MAX_SET_ENTRIES) {
      throw new ReplaySetFullError(MAX_SET_ENTRIES);
    }

    if (replayable.refusal !== null || replayable.taskId === null) {
      throw new UnreplayableEntryError(
        run.value,
        replayable.refusal ?? 'not-a-task-run',
        replayable.reason ?? 'It did not work a task of its own.',
      );
    }

    if (replayable.stationId !== this.state.station.stationId) {
      throw new ReplaySetEntryElsewhereError(run.value);
    }

    const changed = this.with({
      entries: [
        ...this.state.entries,
        ReplaySetEntry.of({
          runId: run,
          taskId: replayable.taskId,
          addedAt: at,
        }),
      ],
    });

    changed.record(new ReplaySetEntriesChanged(this.id, this.workspaceId));

    return changed;
  }

  withoutEntry(run: RunId, searched: boolean): ReplaySet {
    this.unsearched(searched);

    if (!this.includes(run)) {
      throw new UnknownReplaySetEntryError(run.value);
    }

    const changed = this.with({
      entries: this.state.entries.filter((each) => !each.runId.equals(run)),
    });

    changed.record(new ReplaySetEntriesChanged(this.id, this.workspaceId));

    return changed;
  }

  deleted(underway: boolean): ReplaySet {
    if (underway) {
      throw new ReplaySetUnderwayError(this.id.value);
    }

    const deleted = new ReplaySet(this.state, true);

    deleted.inheritEvents(this);
    deleted.record(new ReplaySetDeleted(this.id, this.workspaceId));

    return deleted;
  }

  private unsearched(searched: boolean): void {
    if (searched) {
      throw new ReplaySetUnderwayError(this.id.value);
    }
  }

  private with(part: Partial<State>): ReplaySet {
    const next = new ReplaySet({ ...this.state, ...part }, this.isDeleted);

    next.inheritEvents(this);

    return next;
  }
}
