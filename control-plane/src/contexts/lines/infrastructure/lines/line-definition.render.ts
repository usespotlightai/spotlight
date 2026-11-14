import type {
  LineDefinition,
  LineDefinitionSearch,
  LineDefinitionStation,
  LineDefinitionStationSearch,
} from '@lines/application/contracts/line-definition.contract';
import type { Line } from '@lines/domain/aggregates/line.aggregate';
import type { Station } from '@lines/domain/entities/station.entity';
import type { Reaction } from '@lines/domain/value-objects/reaction.vo';
import type {
  LineSearchPolicy,
  StationSearchOverride,
} from '@lines/domain/value-objects/search-policy.vo';
import { inCodePointOrder } from '@platform/ordering/code-point-order';
import type { StationId } from '@shared-kernel/domain/value-objects/station-id.vo';

const present = <K extends string, V>(
  key: K,
  value: V | null,
): Partial<Record<K, V>> =>
  value === null ? {} : ({ [key]: value } as Record<K, V>);

const placed = (labels: readonly string[]): string[] | null =>
  labels.length > 0 ? [...labels] : null;

const renderStationSearch = (
  search: StationSearchOverride,
): LineDefinitionStationSearch => ({
  ...present('enabled', search.enabled),
  ...present('ceiling', search.ceiling),
  ...present('period', search.period?.text ?? null),
  ...present('onAlert', search.onAlert),
  ...present('cooldown', search.cooldown?.text ?? null),
  ...present(
    'agent',
    search.agent && {
      harness: search.agent.harness.value,
      ...present('model', search.agent.model?.value ?? null),
      ...present('effort', search.agent.effort?.value ?? null),
    },
  ),
  ...present('iterations', search.iterations),
  ...present('repeats', search.repeats),
  ...present('objective', search.objective),
});

const renderLineSearch = (search: LineSearchPolicy): LineDefinitionSearch =>
  search.toPrimitives();

export const renderLine = (line: Line): LineDefinition => {
  const positionOf = new Map(
    line.stations.map((each, at) => [each.id.value, at]),
  );
  const place = (stationId: StationId | null): number =>
    stationId === null ? -1 : (positionOf.get(stationId.value) ?? -1);
  const keyAt = (stationId: StationId): string =>
    line.stationAt(stationId)?.key.value ?? '';
  const inReactionOrder = (one: Reaction, other: Reaction): number =>
    inCodePointOrder(one.happening.value, other.happening.value) ||
    place(one.from) - place(other.from) ||
    place(one.to) - place(other.to);

  const renderStation = (station: Station): LineDefinitionStation => ({
    key: station.key.value,
    name: station.name.value,
    kind: station.kind,
    color: station.color.value,
    ...present('description', station.description?.value ?? null),
    ...present('harness', station.harness?.value ?? null),
    ...present('model', station.model?.value ?? null),
    ...present('effort', station.effort?.value ?? null),
    ...present('profile', station.profile?.value ?? null),
    ...present('prompt', station.agentPrompt?.value ?? null),
    ...present('check', station.check?.value ?? null),
    ...present('runners', placed(station.placement.requiredLabels)),
    diffs: station.diffs,
    decisions: station.decisions,
    memories: station.memories,
    ...present(
      'judge',
      station.judge
        ? {
            ...present('rubric', station.judge.rubric),
            ...(station.judge.claims.length > 0
              ? {
                  claims: [...station.judge.claims],
                  passThreshold: station.judge.passThreshold,
                }
              : {}),
            sample: station.judge.sample,
            minAgreement: station.judge.minAgreement,
          }
        : null,
    ),
    alerts: station.alerts.map((each) => ({
      measure: each.measure,
      ...present('risesBy', each.risesBy),
      ...present('above', each.above),
      ...present('fallsBy', each.fallsBy),
      ...present('below', each.below),
      over: each.over,
    })),
    ...present('search', station.search && renderStationSearch(station.search)),
    tools: station.tools.map((each) => each.value),
    skills: station.skills.map((each) => each.value),
    passesTo: [...station.routes.stations]
      .sort((one, other) => place(one) - place(other))
      .map(keyAt),
    ends: station.routes.ends,
  });

  return {
    key: line.key.value,
    name: line.name.value,
    ...present('role', line.role?.value ?? null),
    repositories: [...line.repositories.entries]
      .sort((one, other) =>
        inCodePointOrder(one.repository.value, other.repository.value),
      )
      .map((each) => ({
        name: each.repository.value,
        ...present('image', each.image?.value ?? null),
        ...present('setup', each.setup?.value ?? null),
      })),
    ...present('runners', placed(line.placement.requiredLabels)),
    warmSandboxes: line.warmSandboxes.value,
    ...present('defaultAssignee', line.defaultAssignee?.email ?? null),
    stations: line.stations.map(renderStation),
    reactions: [...line.reactions].sort(inReactionOrder).map((each) => ({
      happening: each.happening.value,
      ...(each.from ? { from: keyAt(each.from) } : {}),
      to: keyAt(each.to),
    })),
    ...(line.reviews
      ? {
          reviews: {
            start: line.reviews.start,
            mention: line.reviews.mention,
            label: line.reviews.label,
            skip: {
              spotlight: line.reviews.skip.spotlight,
              drafts: line.reviews.skip.drafts,
              authors: [...line.reviews.skip.authors],
            },
          },
        }
      : {}),
    ...(line.replayCheck
      ? {
          replayCheck: {
            maxRegressions: line.replayCheck.maxRegressions,
            ceiling: line.replayCheck.ceiling,
            currency: line.replayCheck.currency,
            minGain: line.replayCheck.minGain,
          },
        }
      : {}),
    ...present('search', line.search && renderLineSearch(line.search)),
    ...(line.source
      ? {
          source: {
            repository: line.source.repository.value,
            path: line.source.path,
          },
        }
      : {}),
  };
};
