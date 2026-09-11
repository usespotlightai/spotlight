import { Station } from '@domain/entities/station.entity';
import { InvalidStationLayoutError } from '@domain/exceptions/invalid-station-layout.error';
import { UnknownHappeningError } from '@domain/exceptions/unknown-happening.error';
import { UnknownStationError } from '@domain/exceptions/unknown-station.error';
import type {
  LineOpening,
  StationOpening,
} from '@domain/services/built-in-lines';
import { handoverOptions } from '@domain/services/handover-options';
import type { AgentPrompt } from '@domain/value-objects/agent-prompt.vo';
import { AssemblyLineId } from '@domain/value-objects/assembly-line-id.vo';
import type { AssemblyLineName } from '@domain/value-objects/assembly-line-name.vo';
import type { Effort } from '@domain/value-objects/effort.vo';
import type { FactoryId } from '@domain/value-objects/factory-id.vo';
import { HandoverOption } from '@domain/value-objects/handover-option.vo';
import type { Happening } from '@domain/value-objects/happening.vo';
import type { HarnessId } from '@domain/value-objects/harness-id.vo';
import type { HarnessModel } from '@domain/value-objects/harness-model.vo';
import { LineKey } from '@domain/value-objects/line-key.vo';
import { LineRepositories } from '@domain/value-objects/line-repositories.vo';
import type { LineRole } from '@domain/value-objects/line-role.vo';
import { Reaction } from '@domain/value-objects/reaction.vo';
import type { Repository } from '@domain/value-objects/repository.vo';
import type { StationColor } from '@domain/value-objects/station-color.vo';
import type { StationDescription } from '@domain/value-objects/station-description.vo';
import { StationId } from '@domain/value-objects/station-id.vo';
import type { StationName } from '@domain/value-objects/station-name.vo';
import { WayOut } from '@domain/value-objects/way-out.vo';
import type { WorkspaceId } from '@domain/value-objects/workspace-id.vo';

export class AssemblyLine {
  private constructor(
    readonly id: AssemblyLineId,
    readonly workspaceId: WorkspaceId,
    readonly factoryId: FactoryId,
    /** What it is called in the file that describes it. */
    readonly key: LineKey,
    readonly name: AssemblyLineName,
    readonly stations: readonly Station[],
    /** What a word from outside does to a task this line already has. */
    readonly reactions: readonly Reaction[],
    /** What this line is for, where the factory routes work by purpose. */
    readonly role: LineRole | null,
    /**
     * The repositories a run on this line works in. All are pulled into the
     * workspace; which one a task's change belongs in is the agent's to tell.
     */
    readonly repositories: LineRepositories,
  ) {}

  static open(input: {
    workspaceId: WorkspaceId;
    factoryId: FactoryId;
    line: LineOpening;
    newId: () => string;
  }): AssemblyLine {
    const named = input.line.stations;
    const ids = named.map(() => StationId.of(input.newId()));

    // The openings name each other, so the ids exist before any station does.
    const at = (name: string): StationId => {
      const found = named.filter((each) => each.name.value === name);

      if (found.length !== 1) {
        throw new InvalidStationLayoutError(
          `must name one station "${name}", but name ${found.length}`,
        );
      }

      return ids[named.indexOf(found[0] as StationOpening)] as StationId;
    };

    return AssemblyLine.of({
      id: AssemblyLineId.of(input.newId()),
      workspaceId: input.workspaceId,
      factoryId: input.factoryId,
      key: input.line.key,
      name: input.line.name,
      role: input.line.role,
      repositories: input.line.repositories,
      stations: named.map((each, position) =>
        Station.of({
          id: ids[position] as StationId,
          name: each.name,
          color: each.color,
          position,
          kind: each.kind,
          agentPrompt: each.agentPrompt,
          wayOut: WayOut.of({
            stations: each.passesTo.map((to) => at(to)),
            ends: each.ends,
          }),
          tools: each.tools,
        }),
      ),
      reactions: input.line.reactions.map((each) =>
        Reaction.of({ happening: each.happening, to: at(each.to) }),
      ),
    });
  }

  static of(input: {
    id: AssemblyLineId;
    workspaceId: WorkspaceId;
    factoryId: FactoryId;
    key?: LineKey;
    name: AssemblyLineName;
    stations: readonly Station[];
    reactions?: readonly Reaction[];
    role?: LineRole | null;
    repositories?: readonly Repository[];
  }): AssemblyLine {
    const reactions = input.reactions ?? [];

    AssemblyLine.guardPositionsAreContiguous(input.stations);
    AssemblyLine.guardBacklogStandsFirst(input.stations);
    AssemblyLine.guardCompletedStandsLast(input.stations);
    AssemblyLine.guardEveryPassLandsOnTheLine(input.stations);
    AssemblyLine.guardEveryReactionLandsOnTheLine(input.stations, reactions);
    AssemblyLine.guardNoWordReachesTwoStations(reactions);

    return new AssemblyLine(
      input.id,
      input.workspaceId,
      input.factoryId,
      input.key ?? LineKey.from(input.name.value),
      input.name,
      [...input.stations].sort((a, b) => a.position - b.position),
      reactions,
      input.role ?? null,
      LineRepositories.of(input.repositories ?? []),
    );
  }

  repositoryNamed(name: string): Repository | null {
    return this.repositories.named(name);
  }

  /** The repositories this line works in, set whole. */
  worksIn(repositories: readonly Repository[]): AssemblyLine {
    return AssemblyLine.of({
      id: this.id,
      workspaceId: this.workspaceId,
      factoryId: this.factoryId,
      key: this.key,
      name: this.name,
      stations: this.stations,
      reactions: this.reactions,
      role: this.role,
      repositories,
    });
  }

  opening(name: string | null): Repository {
    return this.repositories.opening(name);
  }

  /** Every work station on this line run on the one harness, or none of them. */
  runsOn(harness: HarnessId | null, model: HarnessModel | null): AssemblyLine {
    return AssemblyLine.of({
      id: this.id,
      workspaceId: this.workspaceId,
      factoryId: this.factoryId,
      key: this.key,
      name: this.name,
      stations: this.stations.map((each) =>
        each.isWorked ? each.runsOn(harness, model) : each,
      ),
      reactions: this.reactions,
      role: this.role,
      repositories: this.repositories.all,
    });
  }

  /** Every work station on this line thinks at the one effort, or none does. */
  thinksAt(effort: Effort | null): AssemblyLine {
    return AssemblyLine.of({
      id: this.id,
      workspaceId: this.workspaceId,
      factoryId: this.factoryId,
      key: this.key,
      name: this.name,
      stations: this.stations.map((each) =>
        each.isWorked ? each.atEffort(effort) : each,
      ),
      reactions: this.reactions,
      role: this.role,
      repositories: this.repositories.all,
    });
  }

  renameStation(stationId: StationId, name: StationName): AssemblyLine {
    return this.withStation(stationId, (station) => station.rename(name));
  }

  repaintStation(stationId: StationId, color: StationColor): AssemblyLine {
    return this.withStation(stationId, (station) => station.repaint(color));
  }

  describeStation(
    stationId: StationId,
    description: StationDescription | null,
  ): AssemblyLine {
    return this.withStation(stationId, (station) =>
      station.describe(description),
    );
  }

  runStationOn(
    stationId: StationId,
    harness: HarnessId | null,
    model: HarnessModel | null,
  ): AssemblyLine {
    return this.withStation(stationId, (station) =>
      station.runsOn(harness, model),
    );
  }

  setStationEffort(stationId: StationId, effort: Effort | null): AssemblyLine {
    return this.withStation(stationId, (station) => station.atEffort(effort));
  }

  instructStation(
    stationId: StationId,
    agentPrompt: AgentPrompt | null,
  ): AssemblyLine {
    return this.withStation(stationId, (station) =>
      station.instruct(agentPrompt),
    );
  }

  /**
   * What this line does with that word for a task standing there. A rule
   * naming the station beats one that applies wherever it stands, so a line
   * can say "comments go to review, but from spec they go back to triage".
   */
  reactionTo(happening: Happening, standingAt: StationId): Reaction | null {
    const applies = this.reactions.filter(
      (each) => each.happening.equals(happening) && each.appliesAt(standingAt),
    );

    return applies.find((each) => !each.isEverywhere) ?? applies[0] ?? null;
  }

  /**
   * Written whole rather than changed one at a time: the rules only make
   * sense together, and are few enough to say again.
   */
  reactsWith(
    reactions: readonly Reaction[],
    raised: readonly Happening[],
  ): AssemblyLine {
    AssemblyLine.guardEveryHappeningIsRaised(reactions, raised);

    return AssemblyLine.of({
      id: this.id,
      workspaceId: this.workspaceId,
      factoryId: this.factoryId,
      key: this.key,
      name: this.name,
      stations: this.stations,
      reactions,
      role: this.role,
      repositories: this.repositories.all,
    });
  }

  private static guardEveryHappeningIsRaised(
    reactions: readonly Reaction[],
    raised: readonly Happening[],
  ): void {
    const said = new Set(raised.map((each) => each.value));

    for (const reaction of reactions) {
      if (!said.has(reaction.happening.value)) {
        throw new UnknownHappeningError(reaction.happening.value);
      }
    }
  }

  private withStation(
    stationId: StationId,
    change: (station: Station) => Station,
  ): AssemblyLine {
    const target = this.stations.find((each) => each.id.equals(stationId));

    if (!target) {
      throw new UnknownStationError(stationId.value);
    }

    return AssemblyLine.of({
      id: this.id,
      workspaceId: this.workspaceId,
      factoryId: this.factoryId,
      key: this.key,
      name: this.name,
      reactions: this.reactions,
      stations: this.stations.map((each) =>
        each.equals(target) ? change(each) : each,
      ),
      role: this.role,
      repositories: this.repositories.all,
    });
  }

  private static guardPositionsAreContiguous(
    stations: readonly Station[],
  ): void {
    if (stations.length === 0) {
      throw new InvalidStationLayoutError('must number at least one');
    }

    const positions = stations
      .map((each) => each.position)
      .sort((a, b) => a - b);

    if (positions.some((position, index) => position !== index)) {
      throw new InvalidStationLayoutError(
        `must sit at positions 0 to ${stations.length - 1}, but sit at ${positions.join(', ')}`,
      );
    }
  }

  private static guardBacklogStandsFirst(stations: readonly Station[]): void {
    const backlogs = stations.filter((each) => each.isBacklog);

    if (backlogs.length !== 1) {
      throw new InvalidStationLayoutError(
        `must hold one backlog, but hold ${backlogs.length}`,
      );
    }
    if (backlogs[0]?.position !== 0) {
      throw new InvalidStationLayoutError(
        'must open with their backlog, which is where a task waits to start',
      );
    }
  }

  private static guardEveryPassLandsOnTheLine(
    stations: readonly Station[],
  ): void {
    const worked = new Set(
      stations.filter((each) => each.isWorked).map((each) => each.id.value),
    );

    for (const station of stations) {
      if (station.isCompleted && station.wayOut.stations.length > 0) {
        throw new InvalidStationLayoutError(
          'must end where they end, but completed hands on somewhere',
        );
      }

      for (const to of station.wayOut.stations) {
        if (to.equals(station.id)) {
          throw new InvalidStationLayoutError(
            `must not hand on to themselves, but ${station.name.value} does`,
          );
        }
        // Handing a task somewhere nobody works it would strand it.
        if (!worked.has(to.value)) {
          throw new InvalidStationLayoutError(
            `must hand on to a station work is done at, but ${station.name.value} does not`,
          );
        }
      }
    }
  }

  private static guardEveryReactionLandsOnTheLine(
    stations: readonly Station[],
    reactions: readonly Reaction[],
  ): void {
    const standing = new Set(stations.map((each) => each.id.value));

    for (const reaction of reactions) {
      if (!standing.has(reaction.to.value)) {
        throw new InvalidStationLayoutError(
          `must send "${reaction.happening.value}" to a station on the line`,
        );
      }
      if (reaction.from && !standing.has(reaction.from.value)) {
        throw new InvalidStationLayoutError(
          `must wait for "${reaction.happening.value}" at a station on the line`,
        );
      }
    }
  }

  /** A word landing in two places at once is a fork nobody can settle. */
  private static guardNoWordReachesTwoStations(
    reactions: readonly Reaction[],
  ): void {
    const claimed = new Set<string>();

    for (const reaction of reactions) {
      // One rule per word for a given standing place, and one for wherever it
      // stands: the named place wins, so the two never collide.
      const at = `${reaction.happening.value}@${reaction.from?.value ?? '*'}`;

      if (claimed.has(at)) {
        throw new InvalidStationLayoutError(
          `must send a happening to one station, but two wait for "${reaction.happening.value}"`,
        );
      }
      claimed.add(at);
    }
  }

  private static guardCompletedStandsLast(stations: readonly Station[]): void {
    const ends = stations.filter((each) => each.isCompleted);

    if (ends.length !== 1) {
      throw new InvalidStationLayoutError(
        `must hold one completed, but hold ${ends.length}`,
      );
    }
    if (ends[0]?.position !== stations.length - 1) {
      throw new InvalidStationLayoutError(
        'must close with completed, which is where a merged task lands',
      );
    }
  }

  get completed(): Station {
    const standing = this.stations.find((each) => each.isCompleted);

    if (!standing) {
      throw new InvalidStationLayoutError(
        'must hold one completed, but hold 0',
      );
    }

    return standing;
  }

  get backlog(): Station {
    const standing = this.stations.find((each) => each.isBacklog);

    if (!standing) {
      throw new InvalidStationLayoutError('must hold one backlog, but hold 0');
    }

    return standing;
  }

  get worked(): readonly Station[] {
    return this.stations.filter((each) => each.isWorked);
  }

  /** Where a task enters the line to be worked: the first station work is done
   *  at, and where an analysis of a trace on this line is opened. */
  get entry(): Station | null {
    return this.worked[0] ?? null;
  }

  /**
   * The station standing at this id, asked of the line rather than found in
   * it: a station is the line's to give out, and the line is what knows
   * whether it has one.
   */
  stationAt(stationId: StationId): Station | null {
    return this.stations.find((each) => each.id.equals(stationId)) ?? null;
  }

  /** True where this line is the one holding that station. */
  holds(stationId: StationId): boolean {
    return this.stationAt(stationId) !== null;
  }

  /** Where a task standing here may be handed on to, or a person. */
  optionsFrom(stationId: StationId): HandoverOption[] {
    return handoverOptions(this.stationAt(stationId), this.stations);
  }

  /**
   * How far downstream a station stands, which is what its runs are prioritised
   * by: the shortest distance from the backlog along where work passes, with
   * what finishes the line standing last of all.
   */
  depthOf(stationId: StationId): number {
    return this.depths().get(stationId.value) ?? 0;
  }

  private depths(): ReadonlyMap<string, number> {
    const byId = new Map(this.stations.map((each) => [each.id.value, each]));
    const depth = new Map<string, number>([[this.backlog.id.value, 0]]);
    const queue: Station[] = [this.backlog];

    // Breadth-first, so a station is first reached by its shortest path; rework
    // looping back finds it already set.
    while (queue.length > 0) {
      const station = queue.shift() as Station;
      const here = depth.get(station.id.value) as number;

      for (const to of station.wayOut.stations) {
        const next = byId.get(to.value);

        if (next && !depth.has(to.value)) {
          depth.set(to.value, here + 1);
          queue.push(next);
        }
      }
    }

    const reached = this.stations
      .filter((each) => !each.isCompleted)
      .map((each) => depth.get(each.id.value) ?? 0);
    const last = Math.max(0, ...reached) + 1;

    for (const station of this.stations) {
      if (station.isCompleted) {
        depth.set(station.id.value, last);
      }
    }

    return depth;
  }

  equals(other: AssemblyLine): boolean {
    return this.id.equals(other.id);
  }
}
