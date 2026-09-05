import { AssemblyLine } from '@domain/aggregates/assembly-line.aggregate';
import { linePath } from '@domain/aggregates/team-configuration.aggregate';
import { contributionOf } from '@domain/services/source-contribution';
import { AssemblyLineName } from '@domain/value-objects/assembly-line-name.vo';
import { FactoryId } from '@domain/value-objects/factory-id.vo';
import { SourceKey } from '@domain/value-objects/source-key.vo';
import { WorkspaceId } from '@domain/value-objects/workspace-id.vo';
import { compileLine } from '@infrastructure/integrations/line.compile';
import { renderLine } from '@infrastructure/integrations/line.render';
import { describe, expect, it } from 'vitest';

/**
 * The line Spotlight opens a workspace with, which is what the pull request
 * on installing carries. If this cannot be read back, nothing else in the
 * configuration story stands up.
 */
const built = () => {
  let next = 0;

  return AssemblyLine.open({
    workspaceId: WorkspaceId.of('ws_1'),
    factoryId: FactoryId.of('factory_1'),
    name: AssemblyLineName.of('Default'),
    newId: () => `id_${++next}`,
  }).installing(contributionOf(SourceKey.of('linear')));
};

const readBack = (line: AssemblyLine) => {
  const read = compileLine(linePath(line.key.value), renderLine(line));

  if (!read.ok) {
    throw new Error(
      `will not read back: ${read.problems
        .map((each) => `${each.at} ${each.reason}`)
        .join(', ')}`,
    );
  }

  return read.line;
};

describe('writing a line out and reading it back', () => {
  it('reads back at all', () => {
    expect(readBack(built()).key.value).toBe('default');
  });

  it('keeps every station, in the order they stand in', () => {
    const line = built();

    expect(readBack(line).stations.map((each) => each.key.value)).toEqual(
      [...line.stations]
        .sort((one, other) => one.position - other.position)
        .map((each) => each.key.value),
    );
  });

  it('keeps what each station is called, and what it is', () => {
    const line = built();
    const read = readBack(line);

    for (const [at, station] of read.stations.entries()) {
      const standing = [...line.stations].sort(
        (one, other) => one.position - other.position,
      )[at];

      expect(station.name.value).toBe(standing?.name.value);
      expect(station.kind).toBe(standing?.kind);
      expect(station.color.value).toBe(standing?.color.value);
    }
  });

  // The prompts are the longest thing in the file and the easiest to mangle.
  it('keeps every agent prompt exactly as it was written', () => {
    const line = built();
    const read = readBack(line);

    for (const standing of line.stations) {
      const written = read.stations.find((each) =>
        each.key.equals(standing.key),
      );

      expect(written?.agentPrompt?.value ?? null).toBe(
        standing.agentPrompt?.value ?? null,
      );
    }
  });

  it('keeps the tools each station was given', () => {
    const line = built();
    const read = readBack(line);

    for (const standing of line.stations) {
      const written = read.stations.find((each) =>
        each.key.equals(standing.key),
      );

      expect(written?.tools.map((each) => each.value) ?? []).toEqual(
        standing.tools.map((each) => each.value),
      );
    }
  });

  // Written as keys rather than identifiers, so they have to resolve back.
  it('keeps where work may go from each station', () => {
    const line = built();
    const read = readBack(line);

    for (const standing of line.stations) {
      const written = read.stations.find((each) =>
        each.key.equals(standing.key),
      );
      const expected = standing.wayOut.stations.map(
        (id) =>
          line.stations.find((each) => each.id.equals(id))?.key.value ?? '',
      );

      expect(written?.passesTo.map((each) => each.value) ?? []).toEqual(
        expected,
      );
      expect(written?.ends ?? false).toBe(standing.wayOut.ends);
    }
  });

  it('keeps every reaction, and where each one leads', () => {
    const line = built();
    const read = readBack(line);

    expect(read.reactions).toHaveLength(line.reactions.length);

    for (const reaction of line.reactions) {
      const written = read.reactions.find((each) =>
        each.happening.equals(reaction.happening),
      );
      const to = line.stations.find((each) => each.id.equals(reaction.to));

      expect(written?.to.value).toBe(to?.key.value);
    }
  });

  // An opener — the only way work the line did not raise gets on it — has to
  // read back as one, landing where it did.
  it('keeps every opener, and where each one opens', () => {
    const line = built();
    const read = readBack(line);

    expect(read.openers).toHaveLength(line.openers.length);
    expect(line.openers.length).toBeGreaterThan(0);

    for (const opener of line.openers) {
      const written = read.openers.find((each) =>
        each.happening.equals(opener.happening),
      );
      const to = line.stations.find((each) => each.id.equals(opener.to));

      expect(written?.to.value).toBe(to?.key.value);
    }
  });

  // The second pass has to be identical, or the board and the repository
  // drift a little further apart on every edit.
  it('writes the same file the second time round', () => {
    const line = built();
    const once = renderLine(line);
    const read = compileLine(linePath('default'), once);

    expect(read.ok).toBe(true);
    expect(renderLine(line)).toBe(once);
  });

  it('writes it where that line is read from', () => {
    expect(linePath('default')).toBe('.spotlight/lines/default.yml');
  });
});
