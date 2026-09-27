import { inCodePointOrder } from '@platform/ordering/code-point-order';
import type { LineFields } from '@work/infrastructure/lines/line.schema';
import type {
  line,
  lineReaction,
  lineRepository,
  station,
  stationRoute,
} from '@work/infrastructure/persistence/drizzle/schemas/line.schema';

type Rendered<T> = { -readonly [K in keyof T]: T[K] };

type StationFields = LineFields['stations'][number];

type RepositoryRow = Pick<
  typeof lineRepository.$inferSelect,
  'repository' | 'image' | 'setup'
>;

type StationRow = Pick<
  typeof station.$inferSelect,
  | 'id'
  | 'key'
  | 'name'
  | 'kind'
  | 'color'
  | 'description'
  | 'harness'
  | 'model'
  | 'effort'
  | 'profile'
  | 'agentPrompt'
  | 'check'
  | 'runners'
  | 'diffs'
  | 'decisions'
  | 'memories'
  | 'finishes'
>;

interface Given {
  readonly stationId: string;
  readonly name: string;
}

export interface LineRows {
  readonly line: Pick<
    typeof line.$inferSelect,
    'key' | 'name' | 'role' | 'reviews' | 'runners'
  >;
  readonly stations: readonly StationRow[];
  readonly routes: readonly Pick<
    typeof stationRoute.$inferSelect,
    'stationId' | 'toStationId'
  >[];
  readonly tools: readonly Given[];
  readonly skills: readonly Given[];
  readonly reactions: readonly Pick<
    typeof lineReaction.$inferSelect,
    'happening' | 'fromStationId' | 'toStationId'
  >[];
  readonly repositories: readonly RepositoryRow[];
}

const present = <K extends string, V>(
  key: K,
  held: V | null,
): Partial<Record<K, V>> =>
  held === null ? {} : ({ [key]: held } as Record<K, V>);

const placed = (runners: readonly string[]): string[] | null =>
  runners.length > 0 ? [...runners] : null;

const givenAt = (given: readonly Given[], stationId: string): string[] =>
  given.filter((each) => each.stationId === stationId).map((each) => each.name);

type ReactionRow = LineRows['reactions'][number];

const inReactionOrder =
  (place: (stationId: string | null) => number) =>
  (one: ReactionRow, other: ReactionRow): number =>
    inCodePointOrder(one.happening, other.happening) ||
    place(one.fromStationId) - place(other.fromStationId) ||
    place(one.toStationId) - place(other.toStationId);

export const renderLineRows = (rows: LineRows): Rendered<LineFields> => {
  const keyOf = new Map(rows.stations.map((each) => [each.id, each.key]));
  const positionOf = new Map(rows.stations.map((each, at) => [each.id, at]));
  const at = (stationId: string): string => keyOf.get(stationId) ?? '';
  const place = (stationId: string | null): number =>
    stationId === null ? -1 : (positionOf.get(stationId) ?? -1);

  const renderStation = (row: StationRow): Rendered<StationFields> => ({
    key: row.key,
    name: row.name,
    kind: row.kind,
    color: row.color,
    ...present('description', row.description),
    ...present('harness', row.harness),
    ...present('model', row.model),
    ...(present('effort', row.effort) as Partial<
      Pick<StationFields, 'effort'>
    >),
    ...present('profile', row.profile),
    ...present('prompt', row.agentPrompt),
    ...present('check', row.check),
    ...present('runners', placed(row.runners)),
    diffs: row.diffs,
    decisions: row.decisions,
    memories: row.memories,
    tools: givenAt(rows.tools, row.id),
    skills: givenAt(rows.skills, row.id),
    passesTo: rows.routes
      .filter((each) => each.stationId === row.id)
      .sort((one, other) => place(one.toStationId) - place(other.toStationId))
      .map((each) => at(each.toStationId)),
    ends: row.finishes,
  });

  return {
    key: rows.line.key,
    name: rows.line.name,
    ...present('role', rows.line.role),
    repositories: [...rows.repositories]
      .sort((one, other) => inCodePointOrder(one.repository, other.repository))
      .map((each) => ({
        name: each.repository,
        ...present('image', each.image),
        ...present('setup', each.setup),
      })),
    ...present('runners', placed(rows.line.runners)),
    stations: rows.stations.map(renderStation),
    reactions: [...rows.reactions].sort(inReactionOrder(place)).map((each) => ({
      happening: each.happening,
      ...(each.fromStationId ? { from: at(each.fromStationId) } : {}),
      to: at(each.toStationId),
    })),
    ...(rows.line.reviews
      ? {
          reviews: {
            start: rows.line.reviews.start as 'opened' | 'mentioned',
            mention: rows.line.reviews.mention,
            skip: {
              spotlight: rows.line.reviews.skip.spotlight,
              drafts: rows.line.reviews.skip.drafts,
              authors: [...rows.line.reviews.skip.authors],
            },
          },
        }
      : {}),
  };
};
