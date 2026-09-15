import { Line } from '@domain/aggregates/line.aggregate';
import { Station } from '@domain/entities/station.entity';
import type { FactoryId } from '@domain/value-objects/factory-id.vo';
import type { LineId } from '@domain/value-objects/line-id.vo';
import type { LinePlan } from '@domain/value-objects/line-plan.vo';
import { Reaction } from '@domain/value-objects/reaction.vo';
import { StationId } from '@domain/value-objects/station-id.vo';
import type { StationKey } from '@domain/value-objects/station-key.vo';
import { WayOut } from '@domain/value-objects/way-out.vo';
import type { WorkspaceId } from '@domain/value-objects/workspace-id.vo';

export interface Stranded {
  readonly key: string;
  readonly name: string;
  readonly tasks: number;
}

export type TasksStanding = ReadonlyMap<string, number>;

export interface LineIdentity {
  readonly id: LineId;
  readonly workspaceId: WorkspaceId;
  readonly factoryId: FactoryId;
}

export type Reconciled =
  | { readonly ok: true; readonly line: Line }
  | { readonly ok: false; readonly stranded: readonly Stranded[] };

export const reconcileLine = (input: {
  standing: Line;
  plan: LinePlan;
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
}): Line => assemble(input.identity, input.plan, () => null, input.newId);

const assemble = (
  identity: LineIdentity,
  plan: LinePlan,
  kept: (key: string) => StationId | null,
  newId: () => string,
): Line => {
  const idOf = new Map<string, StationId>(
    plan.stations.map((each) => [
      each.key.value,
      kept(each.key.value) ?? StationId.of(newId()),
    ]),
  );

  const at = (key: StationKey): StationId => idOf.get(key.value) as StationId;

  const stations = plan.stations.map((planned, position) =>
    Station.of({
      id: idOf.get(planned.key.value) as StationId,
      key: planned.key,
      name: planned.name,
      position,
      color: planned.color,
      description: planned.description,
      kind: planned.kind,
      harness: planned.harness,
      model: planned.model,
      effort: planned.effort,
      agentPrompt: planned.agentPrompt,
      tools: planned.tools,
      skills: planned.skills,
      wayOut: WayOut.of({
        stations: planned.passesTo.map((each) => at(each)),
        ends: planned.ends,
      }),
    }),
  );

  return Line.of({
    id: identity.id,
    workspaceId: identity.workspaceId,
    factoryId: identity.factoryId,
    key: plan.key,
    name: plan.name,
    role: plan.role,
    repositories: plan.repositories,
    stations,
    reactions: plan.reactions.map((planned) =>
      Reaction.of({
        happening: planned.happening,
        from: planned.from ? at(planned.from) : null,
        to: at(planned.to),
      }),
    ),
  });
};
