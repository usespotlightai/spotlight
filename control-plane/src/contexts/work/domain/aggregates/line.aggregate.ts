import { EventRecorder } from '@shared-kernel/domain/event-recorder';
import { ImmutableFieldError } from '@shared-kernel/domain/exceptions/immutable-field.error';
import { InconsistentStateError } from '@shared-kernel/domain/exceptions/inconsistent-state.error';
import { sameOrBothNone } from '@shared-kernel/domain/services/same-or-both-none';
import type { ChangeActor } from '@shared-kernel/domain/value-objects/change-actor.vo';
import { ConfigurationChange } from '@shared-kernel/domain/value-objects/configuration-change.vo';
import type { HarnessId } from '@shared-kernel/domain/value-objects/harness-id.vo';
import type { HarnessModel } from '@shared-kernel/domain/value-objects/harness-model.vo';
import type { Repository } from '@shared-kernel/domain/value-objects/repository.vo';
import type { RunnerImage } from '@shared-kernel/domain/value-objects/runner-image.vo';
import { RunnerPlacement } from '@shared-kernel/domain/value-objects/runner-placement.vo';
import type { TeamId } from '@shared-kernel/domain/value-objects/team-id.vo';
import type { WorkspaceId } from '@shared-kernel/domain/value-objects/workspace-id.vo';
import { Station } from '@work/domain/entities/station.entity';
import { LineCreated } from '@work/domain/events/line-created.event';
import { LineDeleted } from '@work/domain/events/line-deleted.event';
import { LineRepositoriesChanged } from '@work/domain/events/line-repositories-changed.event';
import { LineUpdated } from '@work/domain/events/line-updated.event';
import { StationHarnessChanged } from '@work/domain/events/station-harness-changed.event';
import { StationRenamed } from '@work/domain/events/station-renamed.event';
import { InvalidReviewPolicyError } from '@work/domain/exceptions/invalid-review-policy.error';
import { InvalidStationLayoutError } from '@work/domain/exceptions/invalid-station-layout.error';
import { LineInUseError } from '@work/domain/exceptions/line-in-use.error';
import { LineVersionConflictError } from '@work/domain/exceptions/line-version-conflict.error';
import { UnknownHappeningError } from '@work/domain/exceptions/unknown-happening.error';
import { UnknownStationError } from '@work/domain/exceptions/unknown-station.error';
import { UnreadyRepositoryError } from '@work/domain/exceptions/unready-repository.error';
import type { LineOpening } from '@work/domain/services/built-in-lines';
import { entryOf } from '@work/domain/services/line-entry';
import {
  reactionsProblem,
  setupProblem,
  stationsProblem,
} from '@work/domain/services/line-layout';
import type { TaskCounts } from '@work/domain/services/reconcile-line';
import type { AgentPrompt } from '@work/domain/value-objects/agent-prompt.vo';
import type { ConfigSource } from '@work/domain/value-objects/config-source.vo';
import type { Effort } from '@work/domain/value-objects/effort.vo';
import { HandoverOption } from '@work/domain/value-objects/handover-option.vo';
import type { Happening } from '@work/domain/value-objects/happening.vo';
import type {
  MoveDenial,
  PassDenial,
} from '@work/domain/value-objects/line-denial';
import { LineId } from '@work/domain/value-objects/line-id.vo';
import type { LineKey } from '@work/domain/value-objects/line-key.vo';
import type { LineName } from '@work/domain/value-objects/line-name.vo';
import { LineRepositories } from '@work/domain/value-objects/line-repositories.vo';
import type { LineRepositoryConfig } from '@work/domain/value-objects/line-repository-config.vo';
import { LineRole } from '@work/domain/value-objects/line-role.vo';
import { Reaction } from '@work/domain/value-objects/reaction.vo';
import type { ReplayCheckPolicy } from '@work/domain/value-objects/replay-check-policy.vo';
import {
  type ReviewPolicy,
  reviewsOn,
} from '@work/domain/value-objects/review-policy.vo';
import type { ReviewRequestReceived } from '@work/domain/value-objects/review-request.vo';
import type { SkillKey } from '@work/domain/value-objects/skill-key.vo';
import type { StationColor } from '@work/domain/value-objects/station-color.vo';
import type { StationDescription } from '@work/domain/value-objects/station-description.vo';
import { StationId } from '@work/domain/value-objects/station-id.vo';
import type { StationKey } from '@work/domain/value-objects/station-key.vo';
import type { StationName } from '@work/domain/value-objects/station-name.vo';
import { StationRoutes } from '@work/domain/value-objects/station-routes.vo';

export interface LineLayout {
  readonly key: LineKey;
  readonly name: LineName;
  readonly stations: readonly Station[];
  readonly reactions?: readonly Reaction[];
  readonly role?: LineRole | null;
  readonly repositories?: readonly LineRepositoryConfig[];
  readonly reviews?: ReviewPolicy | null;
  readonly placement?: RunnerPlacement;
  readonly replayCheck?: ReplayCheckPolicy | null;
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
    readonly replayCheck: ReplayCheckPolicy | null,
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
          position,
          kind: each.kind,
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
      ),
    );

    return created;
  }

  static rehydrate(
    input: LineIdentity & LineLayout & { version?: number },
  ): Line {
    return Line.build(input, input, input.version ?? 0);
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
    const keyOf = new Map(
      stations.map((each) => [each.id.value, each.key.value]),
    );
    const laid = stationsProblem(
      stations.map((each) => ({
        key: each.key.value,
        name: each.name.value,
        kind: each.kind,
        passesTo: each.routes.stations.map((to) => keyOf.get(to.value) ?? ''),
      })),
    );

    if (laid) {
      throw new InvalidStationLayoutError(laid.reason);
    }

    const reacting = reactionsProblem(
      reactions.map((each) => ({
        happening: each.happening.value,
        from: each.from ? (keyOf.get(each.from.value) ?? '') : null,
        to: keyOf.get(each.to.value) ?? '',
      })),
      new Set(keyOf.values()),
    );

    if (reacting) {
      throw new InvalidStationLayoutError(reacting.reason);
    }

    const repositories = LineRepositories.of(layout.repositories ?? []);
    const unready = setupProblem(stations, repositories);

    if (unready) {
      throw new UnreadyRepositoryError(unready.reason);
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
      layout.replayCheck ?? null,
      layout.source ?? null,
      version,
    );
  }

  assertVersion(version: number): void {
    if (version !== this.version) {
      throw new LineVersionConflictError(this.id.value);
    }
  }

  update(layout: LineLayout, by: ChangeActor): Line {
    if (!layout.key.equals(this.key)) {
      const because = `cannot change to ${layout.key.value}. Please create a new line instead`;

      throw new ImmutableFieldError(
        'key',
        because,
        `Key of line ${this.key.value} ${because}.`,
      );
    }

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
      ),
    );

    return updated;
  }

  delete(taskCounts: TaskCounts, by: ChangeActor): Line {
    const stranded = this.stations
      .map((each) => ({
        key: each.key.value,
        name: each.name.value,
        tasks: taskCounts.get(each.id.value) ?? 0,
      }))
      .filter((each) => each.tasks > 0);

    if (stranded.length > 0) {
      throw new LineInUseError(this.key.value, stranded);
    }

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
      this.replayCheck,
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
      ),
    );

    return deleted;
  }

  private changed(part: Partial<LineLayout>): Line {
    if (this.isDeleted) {
      throw new InconsistentStateError(
        'line',
        'was changed after it was deleted',
      );
    }

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
        replayCheck:
          part.replayCheck !== undefined ? part.replayCheck : this.replayCheck,
        source: part.source !== undefined ? part.source : this.source,
      },
      this.version,
    );

    next.inheritEvents(this);
    this.recordChangesInto(next);

    return next;
  }

  private get whatChanged() {
    return {
      resource: 'line' as const,
      id: this.id.value,
      key: this.key.value,
    };
  }

  private recordChangesInto(next: Line): void {
    for (const after of next.stations) {
      const before = this.stationAt(after.id);

      if (!before) {
        continue;
      }

      if (!before.name.equals(after.name)) {
        next.record(
          new StationRenamed(this.id, after.id, before.name, after.name),
        );
      }

      if (
        !sameOrBothNone(before.harness, after.harness) ||
        !sameOrBothNone(before.model, after.model)
      ) {
        next.record(
          new StationHarnessChanged(
            this.id,
            after.id,
            after.harness,
            after.model,
          ),
        );
      }
    }

    if (!this.repositories.equals(next.repositories)) {
      next.record(new LineRepositoriesChanged(this.id, next.repositories));
    }
  }

  placementOf(stationId: StationId): RunnerPlacement {
    return (
      this.stationAt(stationId)?.placement.or(this.placement) ?? this.placement
    ).in(this.image);
  }

  get runsIn(): RunnerPlacement {
    return this.placement.in(this.image);
  }

  get image(): RunnerImage | null {
    return this.repositories.image;
  }

  get harness(): HarnessId | null {
    return this.entry?.harness ?? null;
  }

  takesReview(request: ReviewRequestReceived): boolean {
    const repository = request.pullRequest.repository;

    return (
      reviewsOn(this.role) &&
      repository !== null &&
      (this.repositories.isEmpty || this.names(repository)) &&
      (this.reviews?.takes(request) ?? false)
    );
  }

  names(repository: Repository): boolean {
    return this.repositories.all.some((each) => each.equals(repository));
  }

  worksIn(repositories: readonly LineRepositoryConfig[]): Line {
    return this.changed({ repositories });
  }

  opening(name: string | null): Repository {
    return this.repositories.opening(name);
  }

  runsOn(harness: HarnessId | null, model: HarnessModel | null): Line {
    return this.changed({
      stations: this.stations.map((each) =>
        each.isAgentStation ? each.runsOn(harness, model) : each,
      ),
    });
  }

  thinksAt(effort: Effort | null): Line {
    return this.changed({
      stations: this.stations.map((each) =>
        each.isAgentStation ? each.atEffort(effort) : each,
      ),
    });
  }

  renameStation(stationId: StationId, name: StationName): Line {
    return this.withStation(stationId, (station) => station.rename(name));
  }

  repaintStation(stationId: StationId, color: StationColor): Line {
    return this.withStation(stationId, (station) => station.repaint(color));
  }

  describeStation(
    stationId: StationId,
    description: StationDescription | null,
  ): Line {
    return this.withStation(stationId, (station) =>
      station.describe(description),
    );
  }

  changeStationHarness(
    stationId: StationId,
    change: { harness?: HarnessId | null; model?: HarnessModel | null },
  ): Line {
    return this.withStation(stationId, (station) =>
      station.runsOn(
        change.harness !== undefined ? change.harness : station.harness,
        change.model !== undefined ? change.model : station.model,
      ),
    );
  }

  setStationEffort(stationId: StationId, effort: Effort | null): Line {
    return this.withStation(stationId, (station) => station.atEffort(effort));
  }

  instructStation(stationId: StationId, agentPrompt: AgentPrompt | null): Line {
    return this.withStation(stationId, (station) =>
      station.instruct(agentPrompt),
    );
  }

  enableStationSkills(stationId: StationId, skills: readonly SkillKey[]): Line {
    return this.withStation(stationId, (station) =>
      station.enablesSkills(skills),
    );
  }

  reactionTo(happening: Happening, currentStation: StationId): Reaction | null {
    const applies = this.reactions.filter(
      (each) =>
        each.happening.equals(happening) && each.appliesAt(currentStation),
    );

    return applies.find((each) => !each.isEverywhere) ?? applies[0] ?? null;
  }

  reactsWith(
    reactions: readonly Reaction[],
    raised: readonly Happening[],
  ): Line {
    Line.guardEveryHappeningIsRaised(reactions, raised);

    return this.changed({ reactions });
  }

  private static guardEveryHappeningIsRaised(
    reactions: readonly Reaction[],
    raised: readonly Happening[],
  ): void {
    const raisedKeys = new Set(raised.map((each) => each.value));

    for (const reaction of reactions) {
      if (!raisedKeys.has(reaction.happening.value)) {
        throw new UnknownHappeningError(reaction.happening.value);
      }
    }
  }

  private withStation(
    stationId: StationId,
    change: (station: Station) => Station,
  ): Line {
    const target = this.stations.find((each) => each.id.equals(stationId));

    if (!target) {
      throw new UnknownStationError(stationId.value);
    }

    return this.changed({
      stations: this.stations.map((each) =>
        each.equals(target) ? change(each) : each,
      ),
    });
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

  get completed(): Station {
    const station = this.stations.find((each) => each.isCompleted);

    if (!station) {
      throw new InvalidStationLayoutError(
        'must include exactly one completed station, not 0',
      );
    }

    return station;
  }

  get backlog(): Station {
    const station = this.stations.find((each) => each.isBacklog);

    if (!station) {
      throw new InvalidStationLayoutError(
        'must include exactly one backlog, not 0',
      );
    }

    return station;
  }

  get agentStations(): readonly Station[] {
    return this.stations.filter((each) => each.isAgentStation);
  }

  get entry(): Station | null {
    return entryOf(this.stations);
  }

  stationAt(stationId: StationId): Station | null {
    return this.stations.find((each) => each.id.equals(stationId)) ?? null;
  }

  stationKeyed(key: StationKey): Station | null {
    return this.stations.find((each) => each.key.equals(key)) ?? null;
  }

  hasStation(stationId: StationId): boolean {
    return this.stationAt(stationId) !== null;
  }

  optionsFrom(stationId: StationId): readonly HandoverOption[] {
    const from = this.stationAt(stationId);

    return [
      ...this.stations
        .filter((station) => from && this.passDenial(from.id, station) === null)
        .map((station) => HandoverOption.station(station.key, station.name)),
      HandoverOption.review(),
      ...(from?.routes.ends ? [HandoverOption.done()] : []),
    ];
  }

  passDenial(from: StationId, to: Station): PassDenial | null {
    if (to.id.equals(from)) {
      return 'already-there';
    }
    if (!to.harness) {
      return 'nothing-runs';
    }
    if (!this.stationAt(from)?.routes.routesTo(to.id)) {
      return 'no-route';
    }
    return null;
  }

  moveDenial(from: Station, to: Station): MoveDenial | null {
    if (from.id.equals(to.id)) {
      return null;
    }
    if (from.isCompleted) {
      return 'out-of-completed';
    }

    const starts = from.isBacklog && to.isAgentStation;
    const parks = from.isAgentStation && to.isBacklog;

    return starts || parks || to.isCompleted ? null : 'between-work-stations';
  }

  endsAt(stationId: StationId): boolean {
    return this.stationAt(stationId)?.routes.ends ?? false;
  }

  depthOf(stationId: StationId): number {
    return this.depths().get(stationId.value) ?? 0;
  }

  private depths(): ReadonlyMap<string, number> {
    const byId = new Map(this.stations.map((each) => [each.id.value, each]));
    const depth = new Map<string, number>([[this.backlog.id.value, 0]]);
    const queue: Station[] = [this.backlog];

    while (queue.length > 0) {
      const station = queue.shift() as Station;
      const here = depth.get(station.id.value) as number;

      for (const to of station.routes.stations) {
        const next = byId.get(to.value);

        if (next && !depth.has(to.value)) {
          depth.set(to.value, here + 1);
          queue.push(next);
        }
      }
    }

    const depths = this.stations
      .filter((each) => !each.isCompleted)
      .map((each) => depth.get(each.id.value) ?? 0);
    const last = Math.max(0, ...depths) + 1;

    for (const station of this.stations) {
      if (station.isCompleted) {
        depth.set(station.id.value, last);
      }
    }

    return depth;
  }

  equals(other: Line): boolean {
    return this.id.equals(other.id);
  }
}
