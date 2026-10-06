import { StationAlertRaised } from '@outcomes/domain/events/station-alert-raised.event';
import { StationAlertRecovered } from '@outcomes/domain/events/station-alert-recovered.event';
import { StationAlertReopened } from '@outcomes/domain/events/station-alert-reopened.event';
import { InvalidAlertError } from '@outcomes/domain/exceptions/invalid-alert.error';
import { AlertCrossing } from '@outcomes/domain/value-objects/alert-crossing.vo';
import type { AlertId } from '@outcomes/domain/value-objects/alert-id.vo';
import type {
  AlertRule,
  SettledReading,
} from '@outcomes/domain/value-objects/alert-rule.vo';
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
  readonly reading: SettledReading | null;
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

export class StationWatch extends EventRecorder {
  private constructor(
    readonly station: WatchedStation,
    readonly crossings: readonly AlertCrossing[],
    readonly version: number,
    private readonly touched: ReadonlySet<string>,
    readonly dropped: readonly AlertId[],
  ) {
    super();
  }

  static begun(station: WatchedStation): StationWatch {
    return new StationWatch(station, [], 0, new Set(), []);
  }

  static rehydrate(input: {
    station: WatchedStation;
    crossings: readonly AlertCrossing[];
    version: number;
  }): StationWatch {
    const open = input.crossings.filter((each) => each.open);

    if (new Set(open.map((each) => each.rule.key)).size !== open.length) {
      throw new InvalidAlertError(
        'can be crossed only once per rule at a time',
      );
    }

    return new StationWatch(
      input.station,
      input.crossings,
      input.version,
      new Set(),
      [],
    );
  }

  get open(): readonly AlertCrossing[] {
    return this.crossings.filter((each) => each.open);
  }

  get changed(): readonly AlertCrossing[] {
    return this.crossings.filter((each) => this.touched.has(each.id.value));
  }

  crossing(alertId: AlertId): AlertCrossing | null {
    return this.crossings.find((each) => each.id.equals(alertId)) ?? null;
  }

  private settling(rule: AlertRule): AlertCrossing | undefined {
    const [last] = this.crossings
      .filter((each) => !each.open && each.rule.equals(rule))
      .sort(
        (a, b) =>
          (b.recoveredAt?.getTime() ?? 0) - (a.recoveredAt?.getTime() ?? 0),
      );

    return last?.cooling ? last : undefined;
  }

  checked(
    readings: readonly RuleReading[],
    at: Date,
    nextId: () => AlertId,
  ): StationWatch {
    const latest = firstOfEach(readings);
    const watched = new Set(latest.map((each) => each.rule.key));
    const raised: AlertCrossing[] = [];
    const moved = new Map<string, AlertCrossing>();

    for (const open of this.open) {
      if (!watched.has(open.rule.key)) {
        moved.set(open.id.value, open.recovered(at));
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
      const settling = open ? undefined : this.settling(rule);

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
      } else if (settling) {
        const next = crossed
          ? settling.reopened(rule, read, reading.runId)
          : settling.seenClear(reading.runId, at);

        if (next !== settling) {
          moved.set(settling.id.value, next);
        }
      } else if (crossed) {
        raised.push(
          AlertCrossing.of({
            id: nextId(),
            rule,
            reading: read,
            runId: reading.runId,
            taskId: reading.taskId,
            raisedAt: at,
            recoveredAt: null,
            lastSeen: reading.runId,
          }),
        );
      }
    }

    if (raised.length === 0 && moved.size === 0) {
      return this;
    }

    const next = new StationWatch(
      this.station,
      [
        ...this.crossings.map((each) => moved.get(each.id.value) ?? each),
        ...raised,
      ],
      this.version,
      new Set([
        ...this.touched,
        ...moved.keys(),
        ...raised.map((each) => each.id.value),
      ]),
      this.dropped,
    );

    next.inheritEvents(this);

    for (const before of this.crossings) {
      const after = moved.get(before.id.value);

      if (after && before.open && !after.open) {
        next.record(
          new StationAlertRecovered(
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
    for (const each of raised) {
      next.record(
        new StationAlertRaised(
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

  withoutTask(taskId: TaskId): StationWatch {
    const forgotten = this.crossings.filter((each) =>
      each.taskId.equals(taskId),
    );

    if (forgotten.length === 0) {
      return this;
    }

    const gone = new Set(forgotten.map((each) => each.id.value));
    const next = new StationWatch(
      this.station,
      this.crossings.filter((each) => !gone.has(each.id.value)),
      this.version,
      new Set([...this.touched].filter((each) => !gone.has(each))),
      [...this.dropped, ...forgotten.map((each) => each.id)],
    );

    next.inheritEvents(this);

    return next;
  }
}
