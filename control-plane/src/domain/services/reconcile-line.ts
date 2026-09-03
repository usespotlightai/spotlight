import { AssemblyLine } from '@domain/aggregates/assembly-line.aggregate';
import { Station } from '@domain/entities/station.entity';
import type { LinePlan } from '@domain/model/line-plan';
import { Reaction } from '@domain/value-objects/reaction.vo';
import { StationId } from '@domain/value-objects/station-id.vo';
import type { StationKey } from '@domain/value-objects/station-key.vo';
import { WayOut } from '@domain/value-objects/way-out.vo';

/**
 * A station a plan would remove while tasks are still standing at it. Naming
 * them is the whole point: "3 tasks stand at Code Review" is something a
 * person can act on, where a silent refusal is not.
 */
export interface Stranded {
  readonly key: string;
  readonly name: string;
  readonly tasks: number;
}

/** How many tasks stand at each station, by the station's own identifier. */
export type TasksStanding = ReadonlyMap<string, number>;

export type Reconciled =
  | { readonly ok: true; readonly line: AssemblyLine }
  | { readonly ok: false; readonly stranded: readonly Stranded[] };

/**
 * The line a plan describes, made out of the line already standing.
 *
 * A station is matched by its key, and a match keeps its identity. That is
 * what makes configuration safe to edit: renaming a station, repainting it,
 * rewriting its prompt or moving it along the line all leave every task
 * exactly where it was standing, because the station is the same station.
 *
 * Removing one is the exception. A station nobody is standing at goes
 * quietly; one with tasks at it stops the whole plan, because the
 * alternative is deciding on somebody's behalf where their work went.
 */
export const reconcileLine = (input: {
  standing: AssemblyLine;
  plan: LinePlan;
  /**
   * How many tasks stand at each station now, by station identifier. Data
   * rather than a question to ask: nothing in the domain reaches for a
   * repository, and what this needs is a count it was handed.
   */
  tasksStanding: TasksStanding;
  newId: () => string;
}): Reconciled => {
  const held = new Map(
    input.standing.stations.map((each) => [each.key.value, each]),
  );
  const planned = new Set(input.plan.stations.map((each) => each.key.value));

  const stranded: Stranded[] = input.standing.stations
    .filter((each) => !planned.has(each.key.value))
    .map((each) => ({
      key: each.key.value,
      name: each.name.value,
      tasks: input.tasksStanding.get(each.id.value) ?? 0,
    }))
    .filter((each) => each.tasks > 0);

  if (stranded.length > 0) {
    return { ok: false, stranded };
  }

  // Every station has an identity before any of them names another, because
  // where work passes to is written as keys and has to resolve to all of them.
  const idOf = new Map<string, StationId>(
    input.plan.stations.map((each) => [
      each.key.value,
      held.get(each.key.value)?.id ?? StationId.of(input.newId()),
    ]),
  );

  const at = (key: StationKey): StationId | null => idOf.get(key.value) ?? null;

  const stations = input.plan.stations.map((planned, position) =>
    Station.create({
      id: idOf.get(planned.key.value) as StationId,
      key: planned.key,
      name: planned.name,
      position,
      color: planned.color,
      description: planned.description,
      kind: planned.kind,
      harness: planned.harness,
      agentPrompt: planned.agentPrompt,
      tools: planned.tools,
      wayOut: WayOut.of({
        stations: planned.passesTo
          .map((each) => at(each))
          .filter((each): each is StationId => each !== null),
        ends: planned.ends,
      }),
    }),
  );

  return {
    ok: true,
    line: AssemblyLine.of({
      id: input.standing.id,
      workspaceId: input.standing.workspaceId,
      factoryId: input.standing.factoryId,
      key: input.plan.key,
      name: input.plan.name,
      stations,
      reactions: input.plan.reactions
        .map((planned) => {
          const to = at(planned.to);
          const from = planned.from ? at(planned.from) : null;

          return to
            ? Reaction.of({ happening: planned.happening, from, to })
            : null;
        })
        .filter((each): each is Reaction => each !== null),
    }),
  };
};
