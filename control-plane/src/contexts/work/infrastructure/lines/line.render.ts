import { joinFrontmatter } from '@platform/markdown/frontmatter';
import { ConfigurationFile } from '@shared-kernel/domain/value-objects/configuration-file.vo';
import {
  linePath,
  stationPath,
} from '@work/application/contracts/line-layout.contract';
import type { Line } from '@work/domain/aggregates/line.aggregate';
import type { Station } from '@work/domain/entities/station.entity';
import {
  DEFAULT_MENTION,
  type ReviewPolicy,
} from '@work/domain/value-objects/review-policy.vo';
import type { StationId } from '@work/domain/value-objects/station-id.vo';
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
          ...(line.reviews ? { reviews: reviewsWritten(line.reviews) } : {}),
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

const reviewsWritten = (policy: ReviewPolicy): Record<string, unknown> => ({
  start: policy.start,
  ...(policy.mention !== DEFAULT_MENTION ? { mention: policy.mention } : {}),
  skip: {
    spotlight: policy.skip.spotlight,
    drafts: policy.skip.drafts,
    ...(policy.skip.authors.length > 0 ? { authors: policy.skip.authors } : {}),
  },
});

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
    ...(station.check ? { check: station.check.value } : {}),
    ...(station.diffs ? { diffs: true } : {}),
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
