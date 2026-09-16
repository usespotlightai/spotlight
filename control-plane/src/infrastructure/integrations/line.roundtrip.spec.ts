import { Line } from '@domain/aggregates/line.aggregate';
import {
  BUILT_IN_LINES,
  type LineOpening,
} from '@domain/services/built-in-lines';
import { FactoryId } from '@domain/value-objects/factory-id.vo';
import { HarnessId } from '@domain/value-objects/harness-id.vo';
import { HarnessModel } from '@domain/value-objects/harness-model.vo';
import { SkillKey } from '@domain/value-objects/skill-key.vo';
import { WorkspaceId } from '@domain/value-objects/workspace-id.vo';
import { compileLine } from '@infrastructure/integrations/line.compile';
import { renderLine } from '@infrastructure/integrations/line.render';
import { describe, expect, it } from 'vitest';

const built = () => {
  let next = 0;

  return Line.open({
    workspaceId: WorkspaceId.of('ws_1'),
    factoryId: FactoryId.of('factory_1'),
    line: BUILT_IN_LINES[0] as LineOpening,
    newId: () => `id_${++next}`,
  });
};

const readBack = (line: Line) => {
  const read = compileLine(line.key.value, renderLine(line));

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
    expect(readBack(built()).key.value).toBe('delivery');
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

  it('keeps the harness and model each work station runs on', () => {
    const line = built().runsOn(
      HarnessId.of('claude-code'),
      HarnessModel.of('claude-sonnet-5'),
    );
    const read = readBack(line);

    for (const standing of line.worked) {
      const written = read.stations.find((each) =>
        each.key.equals(standing.key),
      );

      expect(written?.harness?.value ?? null).toBe('claude-code');
      expect(written?.model?.value ?? null).toBe('claude-sonnet-5');
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

  it('keeps the team’s own skills each station names', () => {
    const standing = built();
    const station = standing.worked[0];

    if (!station) {
      throw new Error('the built-in line has no station that runs');
    }

    const line = standing.giveStationSkills(station.id, [
      SkillKey.of('grafana-dashboards'),
      SkillKey.of('our-migrations'),
    ]);
    const written = readBack(line).stations.find((each) =>
      each.key.equals(station.key),
    );

    expect(written?.skills.map((each) => each.value)).toEqual([
      'grafana-dashboards',
      'our-migrations',
    ]);
  });

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

  it('writes the same files the second time round', () => {
    const line = built();
    const once = renderLine(line);
    const read = compileLine(line.key.value, once);

    expect(read.ok && read.problems).toEqual([]);
    expect(renderLine(line)).toEqual(once);
  });

  it('writes the line to its folder, and each station to a file of its own', () => {
    expect(renderLine(built()).map((each) => each.path)).toEqual([
      '.spotlight/lines/delivery/line.yml',
      '.spotlight/lines/delivery/stations/backlog.md',
      '.spotlight/lines/delivery/stations/triage.md',
      '.spotlight/lines/delivery/stations/spec.md',
      '.spotlight/lines/delivery/stations/implementation.md',
      '.spotlight/lines/delivery/stations/code-review.md',
      '.spotlight/lines/delivery/stations/completed.md',
    ]);
  });

  it('writes a station’s prompt as the body below its frontmatter', () => {
    const triage = renderLine(built()).find((each) =>
      each.path.endsWith('/triage.md'),
    );

    expect(triage?.text).toMatch(
      /^---\nname: Triage\n[\s\S]*\n---\n\n## Triage\n/,
    );
    expect(triage?.text).not.toMatch(/prompt:/);
  });
});
