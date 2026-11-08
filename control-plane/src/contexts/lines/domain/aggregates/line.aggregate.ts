import { Station } from '@lines/domain/entities/station.entity';
import type { LaidOutStation } from '@lines/domain/events/laid-out-station';
import { LineCreated } from '@lines/domain/events/line-created.event';
import { LineDeleted } from '@lines/domain/events/line-deleted.event';
import { LineUpdated } from '@lines/domain/events/line-updated.event';
import { InvalidReviewPolicyError } from '@lines/domain/exceptions/invalid-review-policy.error';
import { InvalidStationLayoutError } from '@lines/domain/exceptions/invalid-station-layout.error';
import { InvalidStationSearchError } from '@lines/domain/exceptions/invalid-station-search.error';
import { LineInUseError } from '@lines/domain/exceptions/line-in-use.error';
import { LineVersionConflictError } from '@lines/domain/exceptions/line-version-conflict.error';
import { UnreadyRepositoryError } from '@lines/domain/exceptions/unready-repository.error';
import type { LineOpening } from '@lines/domain/services/built-in-lines';
import {
  reactionsProblem,
  searchProblem,
  setupProblem,
  stationsProblem,
} from '@lines/domain/services/line-layout';
import type { ConfigSource } from '@lines/domain/value-objects/config-source.vo';
import { LineRepositories } from '@lines/domain/value-objects/line-repositories.vo';
import type { LineRepositoryConfig } from '@lines/domain/value-objects/line-repository-config.vo';
import { Reaction } from '@lines/domain/value-objects/reaction.vo';
import type { ReplayCheckPolicy } from '@lines/domain/value-objects/replay-check-policy.vo';
import {
  type ReviewPolicy,
  reviewsOn,
} from '@lines/domain/value-objects/review-policy.vo';
import { LineSearchPolicy } from '@lines/domain/value-objects/search-policy.vo';
import { StationRoutes } from '@lines/domain/value-objects/station-routes.vo';
import type {
  StrandedStation,
  TaskCounts,
} from '@lines/domain/value-objects/stranded-station';
import { WarmSandboxCount } from '@lines/domain/value-objects/warm-sandbox-count.vo';
import { EventRecorder } from '@shared-kernel/domain/event-recorder';
import { ImmutableFieldError } from '@shared-kernel/domain/exceptions/immutable-field.error';
import { InconsistentStateError } from '@shared-kernel/domain/exceptions/inconsistent-state.error';
import type { ChangeActor } from '@shared-kernel/domain/value-objects/change-actor.vo';
import { ConfigurationChange } from '@shared-kernel/domain/value-objects/configuration-change.vo';
import type { HarnessId } from '@shared-kernel/domain/value-objects/harness-id.vo';
import { LineId } from '@shared-kernel/domain/value-objects/line-id.vo';
import type { LineKey } from '@shared-kernel/domain/value-objects/line-key.vo';
import type { LineName } from '@shared-kernel/domain/value-objects/line-name.vo';
import { LineRole } from '@shared-kernel/domain/value-objects/line-role.vo';
import { RunnerPlacement } from '@shared-kernel/domain/value-objects/runner-placement.vo';
import { StationId } from '@shared-kernel/domain/value-objects/station-id.vo';
import type { StationKey } from '@shared-kernel/domain/value-objects/station-key.vo';
import type { TeamId } from '@shared-kernel/domain/value-objects/team-id.vo';
import type { WorkspaceId } from '@shared-kernel/domain/value-objects/workspace-id.vo';

export interface LineLayout {
  readonly key: LineKey;
  readonly name: LineName;
  readonly stations: readonly Station[];
  readonly reactions?: readonly Reaction[];
  readonly role?: LineRole | null;
  readonly repositories?: readonly LineRepositoryConfig[];
  readonly reviews?: ReviewPolicy | null;
  readonly placement?: RunnerPlacement;
  readonly warmSandboxes?: WarmSandboxCount;
  readonly replayCheck?: ReplayCheckPolicy | null;
  readonly search?: LineSearchPolicy | null;
  readonly source?: ConfigSource | null;
}

interface LineIdentity {
  readonly id: LineId;
  readonly workspaceId: WorkspaceId;
  readonly teamId: TeamId;
}

export class Line extends EventRecorder {
  private constructor(
    readonly id: LineId,
    readonly workspaceId: WorkspaceId,
    readonly teamId: TeamId,
    readonly key: LineKey,
    readonly name: LineName,
    readonly stations: readonly Station[],
    readonly reactions: readonly Reaction[],
    readonly role: LineRole | null,
    readonly repositories: LineRepositories,
    readonly reviews: ReviewPolicy | null,
    readonly placement: RunnerPlacement,
    readonly warmSandboxes: WarmSandboxCount,
    readonly replayCheck: ReplayCheckPolicy | null,
    readonly search: LineSearchPolicy | null,
    readonly source: ConfigSource | null,
    readonly version: number,
    readonly isDeleted = false,
  ) {
    super();
  }

  static create(input: {
    workspaceId: WorkspaceId;
    teamId: TeamId;
    line: LineOpening;
    harness: HarnessId;
    newId: () => string;
    by: ChangeActor;
  }): Line {
    const named = input.line.stations;
    const ids = named.map(() => StationId.of(input.newId()));

    const at = (key: StationKey): StationId => {
      const found = named.findIndex((each) => each.key.equals(key));

      if (found < 0) {
        throw new InvalidStationLayoutError(
          `must include station ${key.value}`,
        );
      }

      return ids[found] as StationId;
    };

    return Line.createFromLayout({
      id: LineId.of(input.newId()),
      workspaceId: input.workspaceId,
      teamId: input.teamId,
      by: input.by,
      key: input.line.key,
      name: input.line.name,
      role: input.line.role,
      repositories: input.line.repositories,
      reviews: input.line.reviews ?? null,
      stations: named.map((each, position) =>
        Station.of({
          id: ids[position] as StationId,
          key: each.key,
          name: each.name,
          color: each.color,
          description: each.description,
          position,
          kind: each.kind,
          harness: each.kind === 'work' ? input.harness : null,
          agentPrompt: each.agentPrompt,
          routes: StationRoutes.of({
            stations: each.passesTo.map((to) => at(to)),
            ends: each.ends,
          }),
          tools: each.tools,
          skills: each.skills,
          diffs: each.diffs ?? false,
          decisions: each.decisions ?? false,
          memories: each.memories ?? false,
          judge: each.judge ?? null,
        }),
      ),
      reactions: input.line.reactions.map((each) =>
        Reaction.of({ happening: each.happening, to: at(each.to) }),
      ),
    });
  }

  static createFromLayout(
    input: LineIdentity & LineLayout & { by: ChangeActor },
  ): Line {
    const created = Line.build(input, input, 0);

    created.record(
      new LineCreated(
        created.id,
        created.workspaceId,
        created.teamId,
        created.key,
        ConfigurationChange.created(created.whatChanged, input.by),
        created.version,
        created.name,
        created.laidOut,
      ),
    );

    return created;
  }

  static rehydrate(
    input: LineIdentity & LineLayout & { version: number },
  ): Line {
    return Line.build(input, input, input.version);
  }

  private static build(
    identity: LineIdentity,
    layout: LineLayout,
    version: number,
  ): Line {
    const reactions = layout.reactions ?? [];

    Line.guardPositionsAreContiguous(layout.stations);

    const stations = [...layout.stations].sort(
      (a, b) => a.position - b.position,
    );
    const laid = stationsProblem(
      stations.map((each) => ({
        at: each.id,
        key: each.key,
        name: each.name,
        kind: each.kind,
        passesTo: each.routes.stations,
      })),
    );

    if (laid) {
      throw new InvalidStationLayoutError(laid.reason);
    }

    const reacting = reactionsProblem(
      reactions,
      stations.map((each) => each.id),
    );

    if (reacting) {
      throw new InvalidStationLayoutError(reacting.reason);
    }

    const repositories = LineRepositories.of(layout.repositories ?? []);
    const unready = setupProblem(stations, repositories);

    if (unready) {
      throw new UnreadyRepositoryError(unready.reason);
    }

    const searching = searchProblem(
      stations,
      layout.search ?? LineSearchPolicy.DEFAULT,
    );

    if (searching) {
      throw new InvalidStationSearchError(searching.reason);
    }

    if (layout.reviews && !reviewsOn(layout.role ?? null)) {
      throw new InvalidReviewPolicyError(
        `belongs only on a line with role ${LineRole.REVIEW.value}`,
      );
    }

    return new Line(
      identity.id,
      identity.workspaceId,
      identity.teamId,
      layout.key,
      layout.name,
      stations,
      reactions,
      layout.role ?? null,
      repositories,
      layout.reviews ?? null,
      layout.placement ?? RunnerPlacement.anywhere(),
      layout.warmSandboxes ?? WarmSandboxCount.NONE,
      layout.replayCheck ?? null,
      layout.search ?? null,
      layout.source ?? null,
      version,
    );
  }

  get nextVersion(): number {
    return this.version + 1;
  }

  assertVersion(version: number): void {
    if (version !== this.version) {
      throw new LineVersionConflictError(this.id.value);
    }
  }

  update(layout: LineLayout, taskCounts: TaskCounts, by: ChangeActor): Line {
    if (!layout.key.equals(this.key)) {
      const because = `cannot change to ${layout.key.value}. Please create a new line instead`;

      throw new ImmutableFieldError(
        'key',
        because,
        `Key of line ${this.key.value} ${because}.`,
      );
    }

    const kept = new Set(layout.stations.map((each) => each.id.value));

    this.guardNothingStranded(
      this.stations.filter((each) => !kept.has(each.id.value)),
      taskCounts,
    );

    const updated = this.changed(layout);

    updated.record(
      new LineUpdated(
        this.id,
        this.workspaceId,
        this.teamId,
        this.key,
        ConfigurationChange.updated(this.whatChanged, by),
        [
          ...new Map(
            [...this.stations, ...updated.stations].map((each) => [
              each.id.value,
              each.id,
            ]),
          ).values(),
        ],
        this.nextVersion,
        updated.name,
        updated.laidOut,
      ),
    );

    return updated;
  }

  removedIn(next: Line): readonly StationId[] {
    return this.stations
      .filter((each) => !next.stationAt(each.id))
      .map((each) => each.id);
  }

  private guardNothingStranded(
    removed: readonly Station[],
    taskCounts: TaskCounts,
  ): void {
    const stranded: StrandedStation[] = removed
      .map((each) => ({
        key: each.key,
        name: each.name,
        tasks: taskCounts.at(each.id),
      }))
      .filter((each) => each.tasks > 0);

    if (stranded.length > 0) {
      throw new LineInUseError(this.key.value, stranded);
    }
  }

  delete(taskCounts: TaskCounts, by: ChangeActor): Line {
    this.guardNotDeleted();
    this.guardNothingStranded(this.stations, taskCounts);

    const deleted = new Line(
      this.id,
      this.workspaceId,
      this.teamId,
      this.key,
      this.name,
      this.stations,
      this.reactions,
      this.role,
      this.repositories,
      this.reviews,
      this.placement,
      this.warmSandboxes,
      this.replayCheck,
      this.search,
      this.source,
      this.version,
      true,
    );

    deleted.inheritEvents(this);
    deleted.record(
      new LineDeleted(
        this.id,
        this.workspaceId,
        this.teamId,
        this.key,
        ConfigurationChange.deleted(this.whatChanged, by),
        this.stations.map((each) => each.id),
        this.nextVersion,
        this.name,
      ),
    );

    return deleted;
  }

  private guardNotDeleted(): void {
    if (this.isDeleted) {
      throw new InconsistentStateError(
        'line',
        'was changed after it was deleted',
      );
    }
  }

  private changed(part: Partial<LineLayout>): Line {
    this.guardNotDeleted();

    const next = Line.build(
      this,
      {
        key: part.key ?? this.key,
        name: part.name ?? this.name,
        stations: part.stations ?? this.stations,
        reactions: part.reactions ?? this.reactions,
        role: part.role !== undefined ? part.role : this.role,
        repositories: part.repositories ?? this.repositories.entries,
        reviews: part.reviews !== undefined ? part.reviews : this.reviews,
        placement: part.placement ?? this.placement,
        warmSandboxes: part.warmSandboxes ?? this.warmSandboxes,
        replayCheck:
          part.replayCheck !== undefined ? part.replayCheck : this.replayCheck,
        search: part.search !== undefined ? part.search : this.search,
        source: part.source !== undefined ? part.source : this.source,
      },
      this.version,
    );

    next.inheritEvents(this);

    return next;
  }

  get searchPolicy(): LineSearchPolicy {
    return this.search ?? LineSearchPolicy.DEFAULT;
  }

  private get laidOut(): readonly LaidOutStation[] {
    return this.stations.map((each) => ({
      id: each.id,
      key: each.key,
      name: each.name,
      kind: each.kind,
      color: each.color,
      position: each.position,
    }));
  }

  private get whatChanged() {
    return {
      resource: 'line' as const,
      id: this.id.value,
      key: this.key.value,
    };
  }

  private static guardPositionsAreContiguous(
    stations: readonly Station[],
  ): void {
    if (stations.length === 0) {
      throw new InvalidStationLayoutError('must include at least one station');
    }

    const positions = stations
      .map((each) => each.position)
      .sort((a, b) => a - b);

    if (positions.some((position, index) => position !== index)) {
      throw new InvalidStationLayoutError(
        `must sit at positions 0 to ${stations.length - 1}, not ${positions.join(', ')}`,
      );
    }
  }

  stationAt(stationId: StationId): Station | null {
    return this.stations.find((each) => each.id.equals(stationId)) ?? null;
  }

  equals(other: Line): boolean {
    return this.id.equals(other.id);
  }
}
