import { AssemblyLine } from '@domain/aggregates/assembly-line.aggregate';
import { Station } from '@domain/entities/station.entity';
import type { AssemblyLineId } from '@domain/value-objects/assembly-line-id.vo';
import type { FactoryId } from '@domain/value-objects/factory-id.vo';
import type { LinePlan } from '@domain/value-objects/line-plan.vo';
import { Opener } from '@domain/value-objects/opener.vo';
import { Reaction } from '@domain/value-objects/reaction.vo';
import { StationId } from '@domain/value-objects/station-id.vo';
import type { StationKey } from '@domain/value-objects/station-key.vo';
import { WayOut } from '@domain/value-objects/way-out.vo';
import type { WorkspaceId } from '@domain/value-objects/workspace-id.vo';

/** Naming them is the point: a silent refusal is nothing to act on. */
export interface Stranded {
  readonly key: string;
  readonly name: string;
  readonly tasks: number;
}

/** How many tasks stand at each station, by the station's own identifier. */
export type TasksStanding = ReadonlyMap<string, number>;

export interface LineIdentity {
  readonly id: AssemblyLineId;
  readonly workspaceId: WorkspaceId;
  readonly factoryId: FactoryId;
}

export type Reconciled =
  | { readonly ok: true; readonly line: AssemblyLine }
  | { readonly ok: false; readonly stranded: readonly Stranded[] };

/**
 * A station is matched by its key and a match keeps its identity, so renaming
 * or moving one leaves every task where it stood.
 *
 * Removing is the exception: one nobody stands at goes quietly, one with
 * tasks at it stops the whole plan.
 */
export const reconcileLine = (input: {
  standing: AssemblyLine;
  plan: LinePlan;
  /** Data rather than a question: nothing here reaches for a repository. */
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

  const identity: LineIdentity = {
    id: input.standing.id,
    workspaceId: input.standing.workspaceId,
    factoryId: input.standing.factoryId,
  };

  return {
    ok: true,
    line: assemble(
      identity,
      input.plan,
      (key) => held.get(key)?.id ?? null,
      input.newId,
    ),
  };
};

export const openLine = (input: {
  identity: LineIdentity;
  plan: LinePlan;
  newId: () => string;
}): AssemblyLine =>
  assemble(input.identity, input.plan, () => null, input.newId);

const assemble = (
  identity: LineIdentity,
  plan: LinePlan,
  /** The identity a station already had, kept so its tasks are not stranded. */
  kept: (key: string) => StationId | null,
  newId: () => string,
): AssemblyLine => {
  // Every station has an identity before any of them names another, because
  // where work passes to is written as keys and has to resolve to all of them.
  const idOf = new Map<string, StationId>(
    plan.stations.map((each) => [
      each.key.value,
      kept(each.key.value) ?? StationId.of(newId()),
    ]),
  );

  const at = (key: StationKey): StationId | null => idOf.get(key.value) ?? null;

  const stations = plan.stations.map((planned, position) =>
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

  return AssemblyLine.of({
    id: identity.id,
    workspaceId: identity.workspaceId,
    factoryId: identity.factoryId,
    key: plan.key,
    name: plan.name,
    role: plan.role,
    stations,
    reactions: plan.reactions
      .map((planned) => {
        const to = at(planned.to);
        const from = planned.from ? at(planned.from) : null;

        return to
          ? Reaction.of({ happening: planned.happening, from, to })
          : null;
      })
      .filter((each): each is Reaction => each !== null),
    openers: plan.openers
      .map((planned) => {
        const to = at(planned.to);

        return to ? Opener.of({ happening: planned.happening, to }) : null;
      })
      .filter((each): each is Opener => each !== null),
  });
};
