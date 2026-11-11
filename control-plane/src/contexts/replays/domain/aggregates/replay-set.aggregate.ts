import { ReplaySetCreated } from '@replays/domain/events/replay-set-created.event';
import { ReplaySetDeleted } from '@replays/domain/events/replay-set-deleted.event';
import { ReplaySetEntriesChanged } from '@replays/domain/events/replay-set-entries-changed.event';
import { ReplaySetStationGone } from '@replays/domain/events/replay-set-station-gone.event';
import { ReplaySetEntryElsewhereError } from '@replays/domain/exceptions/replay-set-entry-elsewhere.error';
import { ReplaySetEntryTakenError } from '@replays/domain/exceptions/replay-set-entry-taken.error';
import { ReplaySetFullError } from '@replays/domain/exceptions/replay-set-full.error';
import { ReplaySetInUseError } from '@replays/domain/exceptions/replay-set-in-use.error';
import { ReplaySetStationGoneError } from '@replays/domain/exceptions/replay-set-station-gone.error';
import { UnknownReplaySetEntryError } from '@replays/domain/exceptions/unknown-replay-set-entry.error';
import { UnreplayableEntryError } from '@replays/domain/exceptions/unreplayable-entry.error';
import { ReplaySetEntry } from '@replays/domain/value-objects/replay-set-entry.vo';
import type { ReplaySetId } from '@replays/domain/value-objects/replay-set-id.vo';
import { SetEntriesDigest } from '@replays/domain/value-objects/set-entries-digest.vo';
import { SetSnapshot } from '@replays/domain/value-objects/set-snapshot.vo';
import type { SetUsers } from '@replays/domain/value-objects/set-users.vo';
import type { UnreplayableReason } from '@replays/domain/value-objects/unreplayable-reason';
import { EventRecorder } from '@shared-kernel/domain/event-recorder';
import { InconsistentStateError } from '@shared-kernel/domain/exceptions/inconsistent-state.error';
import type { LineId } from '@shared-kernel/domain/value-objects/line-id.vo';
import type { RunId } from '@shared-kernel/domain/value-objects/run-id.vo';
import type { StationId } from '@shared-kernel/domain/value-objects/station-id.vo';
import type { TaskId } from '@shared-kernel/domain/value-objects/task-id.vo';
import type { TeamId } from '@shared-kernel/domain/value-objects/team-id.vo';
import type { WorkspaceId } from '@shared-kernel/domain/value-objects/workspace-id.vo';

export const REPLAY_SET_SIZE = 30;

export interface ReplayedStation {
  readonly workspaceId: WorkspaceId;
  readonly teamId: TeamId;
  readonly lineId: LineId;
  readonly stationId: StationId;
}

export interface Replayable {
  readonly runId: RunId;
  readonly taskId: TaskId | null;
  readonly stationId: StationId | null;
  readonly unreplayableReason: UnreplayableReason | null;
  readonly reason: string | null;
  readonly endedAt: Date;
}

export interface ReplaySetRefresh {
  readonly at: Date;
  readonly added: readonly RunId[];
  readonly removed: readonly RunId[];
}

export interface ReplaySetChanges {
  readonly add: readonly Replayable[];
  readonly remove: readonly RunId[];
}

interface State {
  readonly id: ReplaySetId;
  readonly station: ReplayedStation;
  readonly entries: readonly ReplaySetEntry[];
  readonly createdAt: Date;
  readonly refreshedAt: Date | null;
  readonly lastRefresh: ReplaySetRefresh | null;
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

  static create(input: {
    id: ReplaySetId;
    station: ReplayedStation;
    at: Date;
  }): ReplaySet {
    const created = new ReplaySet(
      {
        id: input.id,
        station: input.station,
        entries: [],
        createdAt: input.at,
        refreshedAt: null,
        lastRefresh: null,
        stationGoneAt: null,
        version: 0,
      },
      false,
    );

    created.record(new ReplaySetCreated(input.id, input.station.workspaceId));

    return created;
  }

  static rehydrate(state: State): ReplaySet {
    if (state.entries.length > REPLAY_SET_SIZE) {
      throw new InconsistentStateError(
        HOLDER,
        `holds ${state.entries.length} runs, more than ${REPLAY_SET_SIZE}`,
      );
    }

    const runs = new Set(state.entries.map((each) => each.runId.value));
    const tasks = new Set(state.entries.map((each) => each.taskId.value));

    if (
      runs.size !== state.entries.length ||
      tasks.size !== state.entries.length
    ) {
      throw new InconsistentStateError(
        HOLDER,
        'holds one run or one task more than once',
      );
    }

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

  get entries(): readonly ReplaySetEntry[] {
    return this.state.entries;
  }

  get runs(): readonly RunId[] {
    return this.state.entries.map((each) => each.runId);
  }

  get createdAt(): Date {
    return this.state.createdAt;
  }

  get refreshedAt(): Date | null {
    return this.state.refreshedAt;
  }

  get lastRefresh(): ReplaySetRefresh | null {
    return this.state.lastRefresh;
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

  digestOfEntries(sha256: (text: string) => string): SetEntriesDigest {
    return SetEntriesDigest.of(
      sha256(
        this.runs
          .map((each) => each.value)
          .sort()
          .join('\n'),
      ),
    );
  }

  get snapshot(): SetSnapshot {
    return SetSnapshot.of({
      id: this.state.id,
      station: this.state.station,
      entries: this.state.entries,
      isAtGoneStation: this.isAtGoneStation,
    });
  }

  includes(run: RunId): boolean {
    return this.state.entries.some((each) => each.runId.equals(run));
  }

  isAtStation(stationId: StationId): boolean {
    return this.state.station.stationId.equals(stationId);
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

  refresh(changes: ReplaySetChanges, at: Date, users: SetUsers): ReplaySet {
    this.stillAtItsStation();

    if (users.inUse) {
      throw new ReplaySetInUseError(this.id.value);
    }

    const removed = this.state.entries.filter((each) =>
      changes.remove.some((run) => run.equals(each.runId)),
    );

    if (removed.length !== changes.remove.length) {
      const [unknown] = changes.remove.filter((run) => !this.includes(run));
      throw new UnknownReplaySetEntryError(unknown?.value ?? '');
    }

    const kept = this.state.entries.filter((each) => !removed.includes(each));
    const entries = [...kept];

    for (const replayable of changes.add) {
      entries.push(this.entryOf(replayable, entries, at));
    }

    const added = entries.slice(kept.length);

    if (entries.length > REPLAY_SET_SIZE) {
      throw new ReplaySetFullError(REPLAY_SET_SIZE);
    }

    if (added.length === 0 && removed.length === 0) {
      return this.with({ refreshedAt: at });
    }

    const changed = this.with({
      entries,
      refreshedAt: at,
      lastRefresh: {
        at,
        added: added.map((each) => each.runId),
        removed: removed.map((each) => each.runId),
      },
    });

    changed.record(new ReplaySetEntriesChanged(this.id, this.workspaceId));

    return changed;
  }

  delete(): ReplaySet {
    const deleted = new ReplaySet(this.state, true);

    deleted.inheritEvents(this);
    deleted.record(new ReplaySetDeleted(this.id, this.workspaceId));

    return deleted;
  }

  private entryOf(
    replayable: Replayable,
    entries: readonly ReplaySetEntry[],
    at: Date,
  ): ReplaySetEntry {
    const run = replayable.runId;

    if (replayable.unreplayableReason !== null || replayable.taskId === null) {
      throw new UnreplayableEntryError(
        run.value,
        replayable.unreplayableReason ?? 'not-a-task-run',
        replayable.reason ?? 'It did not work a task of its own.',
      );
    }

    if (!replayable.stationId?.equals(this.state.station.stationId)) {
      throw new ReplaySetEntryElsewhereError(run.value);
    }

    const task = replayable.taskId;

    if (
      entries.some((each) => each.runId.equals(run) || each.taskId.equals(task))
    ) {
      throw new ReplaySetEntryTakenError(run.value);
    }

    return ReplaySetEntry.of({
      runId: run,
      taskId: task,
      endedAt: replayable.endedAt,
      addedAt: at,
    });
  }

  private with(part: Partial<State>): ReplaySet {
    const next = new ReplaySet({ ...this.state, ...part }, this.isDeleted);

    next.inheritEvents(this);

    return next;
  }
}
