import type { AssemblyLine } from '@domain/aggregates/assembly-line.aggregate';
import type { Station } from '@domain/entities/station.entity';
import type { StationId } from '@domain/value-objects/station-id.vo';
import { stringify } from 'yaml';

/**
 * A line as the file that would describe it.
 *
 * This and the reading of it are one thing in two directions: what Spotlight
 * writes has to be what Spotlight can read, or the board and the repository
 * drift apart the first time anybody edits either. That is worth a test, and
 * has one.
 *
 * Nothing that is not the line's own is written: identifiers a person never
 * typed stay out of the file, because the key is what names a station here.
 */
export const renderLine = (line: AssemblyLine): string => {
  const keyOf = (stationId: StationId): string | null =>
    line.stations.find((each) => each.id.equals(stationId))?.key.value ?? null;

  const stations = [...line.stations]
    .sort((one, other) => one.position - other.position)
    .map((station) => written(station, keyOf));

  const reactions = line.reactions.map((reaction) => {
    const from = reaction.from ? keyOf(reaction.from) : null;

    return {
      happening: reaction.happening.value,
      ...(from ? { from } : {}),
      to: keyOf(reaction.to) ?? '',
    };
  });

  return stringify(
    {
      version: 1,
      key: line.key.value,
      name: line.name.value,
      stations,
      ...(reactions.length > 0 ? { reactions } : {}),
    },
    // Long prompts are the point of the file, so they are written as blocks
    // rather than as one unreadable quoted line.
    { lineWidth: 0, blockQuote: 'literal' },
  );
};

const written = (
  station: Station,
  keyOf: (stationId: StationId) => string | null,
): Record<string, unknown> => {
  const passesTo = station.wayOut.stations
    .map((each) => keyOf(each))
    .filter((each): each is string => each !== null);

  return {
    key: station.key.value,
    name: station.name.value,
    kind: station.kind,
    color: station.color.value,
    ...(station.description ? { description: station.description.value } : {}),
    ...(station.harness ? { harness: station.harness.value } : {}),
    ...(station.agentPrompt ? { prompt: station.agentPrompt.value } : {}),
    ...(station.tools.length > 0
      ? { tools: station.tools.map((each) => each.value) }
      : {}),
    ...(passesTo.length > 0 ? { passesTo } : {}),
    ...(station.wayOut.ends ? { ends: true } : {}),
  };
};
