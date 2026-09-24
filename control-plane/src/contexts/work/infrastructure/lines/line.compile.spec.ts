import { dottedOf } from '@shared-kernel/domain/value-objects/field-path.fake-spec';
import { FieldPath } from '@shared-kernel/domain/value-objects/field-path.vo';
import { compileLine } from '@work/infrastructure/lines/line.compile';
import { describe, expect, it } from 'vitest';

const DELIVERY = {
  key: 'delivery',
  name: 'Default',
  stations: [
    {
      key: 'backlog',
      name: 'Backlog',
      kind: 'backlog',
      passesTo: ['code-review'],
    },
    {
      key: 'code-review',
      name: 'Code Review',
      ends: true,
      prompt: '## Code review\n\nReview it.\n',
    },
    { key: 'completed', name: 'Completed', kind: 'completed' },
  ],
  reactions: [{ happening: 'github.pull_request.merged', to: 'completed' }],
};

const withStation = (at: number, station: Record<string, unknown>) => ({
  ...DELIVERY,
  stations: DELIVERY.stations.map((each, index) =>
    index === at ? station : each,
  ),
});

const refused = (held: unknown) => {
  const compiled = compileLine(held);

  if (compiled.ok) {
    throw new Error('it compiled');
  }

  return compiled.problems;
};

describe('compileLine', () => {
  it('compiles every station, in the order the line lists them', () => {
    const compiled = compileLine(DELIVERY);

    expect(compiled.ok).toBe(true);
    expect(
      compiled.ok && compiled.line.stations.map((each) => each.key.value),
    ).toEqual(['backlog', 'code-review', 'completed']);
  });

  it('reads a station’s prompt exactly as written, and none where it has none', () => {
    const compiled = compileLine(DELIVERY);

    expect(compiled.ok && compiled.line.stations[1]?.agentPrompt?.value).toBe(
      '## Code review\n\nReview it.\n',
    );
    expect(compiled.ok && compiled.line.stations[0]?.agentPrompt).toBeNull();
  });

  it('refuses a prompt of nothing but space', () => {
    expect(
      refused(
        withStation(1, {
          key: 'code-review',
          name: 'Code Review',
          ends: true,
          prompt: ' \n\n',
        }),
      )[0],
    ).toMatchObject({ field: FieldPath.dotted('stations.1.prompt') });
  });

  it('reads the reactions along with the stations', () => {
    const compiled = compileLine(DELIVERY);

    expect(compiled.ok && compiled.line.reactions).toHaveLength(1);
    expect(compiled.ok && compiled.line.reactions[0]?.to.value).toBe(
      'completed',
    );
  });

  it('fills in what a definition left out', () => {
    const compiled = compileLine(DELIVERY);
    const completed = compiled.ok ? compiled.line.stations[2] : undefined;

    expect(completed?.key.value).toBe('completed');
    expect([completed?.tools, completed?.passesTo, completed?.ends]).toEqual([
      [],
      [],
      false,
    ]);
  });

  it('places every problem at the line it is about', () => {
    expect(refused({ ...DELIVERY, name: '' })[0]).toMatchObject({
      path: 'lines/delivery',
      field: FieldPath.dotted('name'),
    });
  });

  it('places a line whose key is unusable at the lines themselves', () => {
    expect(refused({ ...DELIVERY, key: 'Not A Key' })[0]).toMatchObject({
      path: 'lines',
      field: FieldPath.dotted('key'),
    });
  });

  it('refuses a line with no stations', () => {
    expect(dottedOf(refused({ ...DELIVERY, stations: [] })[0]?.field)).toBe(
      'stations',
    );
  });

  it('places a problem with a station’s fields at that station', () => {
    expect(
      refused(withStation(2, { key: 'completed', kind: 'completed' }))[0],
    ).toMatchObject({
      path: 'lines/delivery',
      field: FieldPath.dotted('stations.2.name'),
    });
  });

  it('places a problem with how a station hands on at that station', () => {
    expect(
      refused(
        withStation(0, {
          key: 'backlog',
          name: 'Backlog',
          kind: 'backlog',
          passesTo: ['backlog'],
        }),
      )[0],
    ).toMatchObject({
      path: 'lines/delivery',
      field: FieldPath.dotted('stations.0.passesTo'),
    });
  });

  it('places a problem with what a station gives at that station', () => {
    expect(
      refused(
        withStation(1, {
          key: 'code-review',
          name: 'Code Review',
          ends: true,
          tools: ['pull-request', 'pull-request'],
        }),
      )[0],
    ).toMatchObject({
      path: 'lines/delivery',
      field: FieldPath.dotted('stations.1.tools'),
    });
  });

  it('places a problem with a reaction at that reaction', () => {
    expect(
      refused({
        ...DELIVERY,
        reactions: [
          ...DELIVERY.reactions,
          { happening: 'github.checks.failed', to: 'nowhere' },
        ],
      })[0],
    ).toMatchObject({
      path: 'lines/delivery',
      field: FieldPath.dotted('reactions.1.to'),
    });
  });

  it('refuses a station that checks its layers with no setup', () => {
    expect(
      refused(
        withStation(1, {
          key: 'code-review',
          name: 'Code Review',
          ends: true,
          check: 'npm test',
          diffs: true,
        }),
      )[0],
    ).toMatchObject({ field: FieldPath.dotted('stations.1.setup') });
  });

  it('refuses what is not a line at all', () => {
    expect(refused('version: 1')[0]).toMatchObject({
      path: 'lines',
      field: FieldPath.root(),
    });
  });
});
