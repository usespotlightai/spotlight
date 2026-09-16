import type { Line } from '@domain/aggregates/line.aggregate';
import {
  linePath,
  stationPath,
} from '@domain/aggregates/team-configuration.aggregate';
import type { Station } from '@domain/entities/station.entity';
import { ConfigurationFile } from '@domain/value-objects/configuration-file.vo';
import type { StationId } from '@domain/value-objects/station-id.vo';
import { joinFrontmatter } from '@infrastructure/markdown/frontmatter';
import { stringify } from 'yaml';

const YAML = { lineWidth: 0, blockQuote: 'literal' } as const;

export const renderLine = (line: Line): readonly ConfigurationFile[] => {
  const keyOf = (stationId: StationId): string | null =>
    line.stations.find((each) => each.id.equals(stationId))?.key.value ?? null;

  const stations = [...line.stations].sort(
    (one, other) => one.position - other.position,
  );

  const reactions = line.reactions.map((reaction) => {
    const from = reaction.from ? keyOf(reaction.from) : null;

    return {
      happening: reaction.happening.value,
      ...(from ? { from } : {}),
      to: keyOf(reaction.to) ?? '',
    };
  });

  return [
    ConfigurationFile.of(
      linePath(line.key.value),
      stringify(
        {
          version: 1,
          name: line.name.value,
          ...(line.role ? { role: line.role.value } : {}),
          ...(line.repositories.all.length > 0
            ? { repositories: line.repositories.all.map((each) => each.value) }
            : {}),
          stations: stations.map((each) => each.key.value),
          ...(reactions.length > 0 ? { reactions } : {}),
        },
        YAML,
      ),
    ),
    ...stations.map((station) =>
      ConfigurationFile.of(
        stationPath(line.key.value, station.key.value),
        joinFrontmatter({
          front: stringify(written(station, keyOf), YAML),
          body: station.agentPrompt?.value ?? '',
        }),
      ),
    ),
  ];
};

const written = (
  station: Station,
  keyOf: (stationId: StationId) => string | null,
): Record<string, unknown> => {
  const passesTo = station.wayOut.stations
    .map((each) => keyOf(each))
    .filter((each): each is string => each !== null);

  return {
    name: station.name.value,
    ...(station.kind !== 'work' ? { kind: station.kind } : {}),
    color: station.color.value,
    ...(station.description ? { description: station.description.value } : {}),
    ...(station.harness ? { harness: station.harness.value } : {}),
    ...(station.model ? { model: station.model.value } : {}),
    ...(station.effort ? { effort: station.effort.value } : {}),
    ...(station.tools.length > 0
      ? { tools: station.tools.map((each) => each.value) }
      : {}),
    ...(station.skills.length > 0
      ? { skills: station.skills.map((each) => each.value) }
      : {}),
    ...(passesTo.length > 0 ? { passesTo } : {}),
    ...(station.wayOut.ends ? { ends: true } : {}),
  };
};
