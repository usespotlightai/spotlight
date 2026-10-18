import { StationAlertFired } from '@insights/domain/events/station-alert-fired.event';
import { StationAlertReopened } from '@insights/domain/events/station-alert-reopened.event';
import { StationAlertResolved } from '@insights/domain/events/station-alert-resolved.event';
import { InvalidAlertError } from '@insights/domain/exceptions/invalid-alert.error';
import { AlertFiring } from '@insights/domain/value-objects/alert-firing.vo';
import type { AlertId } from '@insights/domain/value-objects/alert-id.vo';
import type {
  AlertRule,
  FinalReading,
} from '@insights/domain/value-objects/alert-rule.vo';
import { EventRecorder } from '@shared-kernel/domain/event-recorder';
import type { TaskId } from '@shared-kernel/domain/value-objects/task-id.vo';
import type { TeamId } from '@shared-kernel/domain/value-objects/team-id.vo';
import type { WorkspaceId } from '@shared-kernel/domain/value-objects/workspace-id.vo';

export interface WatchedStation {
  readonly workspaceId: WorkspaceId;
  readonly teamId: TeamId;
  readonly lineId: string;
  readonly stationId: string;
}

export interface RuleReading {
  readonly rule: AlertRule;
  readonly reading: FinalReading | null;
}

const firstOfEach = (readings: readonly RuleReading[]): RuleReading[] => {
  const first = new Map<string, RuleReading>();

  for (const each of readings) {
    if (!first.has(each.rule.key)) {
      first.set(each.rule.key, each);
    }
  }

  return [...first.values()];
};

export class StationAlertState extends EventRecorder {
  private constructor(
    readonly station: WatchedStation,
    readonly firings: readonly AlertFiring[],
    readonly version: number,
    private readonly touched: ReadonlySet<string>,
    readonly dropped: readonly AlertId[],
  ) {
    super();
  }

  static start(station: WatchedStation): StationAlertState {
    return new StationAlertState(station, [], 0, new Set(), []);
  }

  static rehydrate(input: {
    station: WatchedStation;
    firings: readonly AlertFiring[];
    version: number;
  }): StationAlertState {
    const open = input.firings.filter((each) => each.open);

    if (new Set(open.map((each) => each.rule.key)).size !== open.length) {
      throw new InvalidAlertError('can fire only once per rule at a time');
    }

    return new StationAlertState(
      input.station,
      input.firings,
      input.version,
      new Set(),
      [],
    );
  }

  get open(): readonly AlertFiring[] {
    return this.firings.filter((each) => each.open);
  }

  get changed(): readonly AlertFiring[] {
    return this.firings.filter((each) => this.touched.has(each.id.value));
  }

  firing(alertId: AlertId): AlertFiring | null {
    return this.firings.find((each) => each.id.equals(alertId)) ?? null;
  }

  private inCooldown(rule: AlertRule): AlertFiring | undefined {
    const [last] = this.firings
      .filter((each) => !each.open && each.rule.equals(rule))
      .sort(
        (a, b) =>
          (b.resolvedAt?.getTime() ?? 0) - (a.resolvedAt?.getTime() ?? 0),
      );

    return last?.cooling ? last : undefined;
  }

  check(
    readings: readonly RuleReading[],
    at: Date,
    nextId: () => AlertId,
  ): StationAlertState {
    const latest = firstOfEach(readings);
    const watched = new Set(latest.map((each) => each.rule.key));
    const fired: AlertFiring[] = [];
    const moved = new Map<string, AlertFiring>();

    for (const open of this.open) {
      if (!watched.has(open.rule.key)) {
        moved.set(open.id.value, open.resolved(at));
      }
    }

    for (const { rule, reading } of latest) {
      if (reading === null) {
        continue;
      }

      const crossed = rule.crossedBy(reading);
      const read = {
        value: reading.value,
        baseline: rule.compares ? reading.baseline : null,
      };
      const open = this.open.find((each) => each.rule.equals(rule));
      const cooling = open ? undefined : this.inCooldown(rule);

      if (open) {
        const seen = crossed
          ? open.seenCrossed(reading.runId)
          : open.seenClear(reading.runId, at);
        const next =
          crossed && !open.rule.setAlike(rule)
            ? seen.rejudged(rule, read)
            : seen;

        if (next !== open) {
          moved.set(open.id.value, next);
        }
      } else if (cooling) {
        const next = crossed
          ? cooling.reopened(rule, read, reading.runId)
          : cooling.seenClear(reading.runId, at);

        if (next !== cooling) {
          moved.set(cooling.id.value, next);
        }
      } else if (crossed) {
        fired.push(
          AlertFiring.of({
            id: nextId(),
            rule,
            reading: read,
            runId: reading.runId,
            taskId: reading.taskId,
            firedAt: at,
            resolvedAt: null,
            lastSeen: reading.runId,
          }),
        );
      }
    }

    if (fired.length === 0 && moved.size === 0) {
      return this;
    }

    const next = new StationAlertState(
      this.station,
      [
        ...this.firings.map((each) => moved.get(each.id.value) ?? each),
        ...fired,
      ],
      this.version,
      new Set([
        ...this.touched,
        ...moved.keys(),
        ...fired.map((each) => each.id.value),
      ]),
      this.dropped,
    );

    next.inheritEvents(this);

    for (const before of this.firings) {
      const after = moved.get(before.id.value);

      if (after && before.open && !after.open) {
        next.record(
          new StationAlertResolved(
            after.id,
            this.station.workspaceId,
            this.station.stationId,
            after.taskId,
          ),
        );
      }
      if (after && !before.open && after.open) {
        next.record(
          new StationAlertReopened(
            after.id,
            this.station.workspaceId,
            this.station.stationId,
            after.taskId,
          ),
        );
      }
    }
    for (const each of fired) {
      next.record(
        new StationAlertFired(
          each.id,
          this.station.workspaceId,
          this.station.teamId,
          this.station.stationId,
          each.taskId,
          each.runId,
        ),
      );
    }

    return next;
  }

  withoutTask(taskId: TaskId): StationAlertState {
    const removed = this.firings.filter((each) => each.taskId.equals(taskId));

    if (removed.length === 0) {
      return this;
    }

    const gone = new Set(removed.map((each) => each.id.value));
    const next = new StationAlertState(
      this.station,
      this.firings.filter((each) => !gone.has(each.id.value)),
      this.version,
      new Set([...this.touched].filter((each) => !gone.has(each))),
      [...this.dropped, ...removed.map((each) => each.id)],
    );

    next.inheritEvents(this);

    return next;
  }
}
