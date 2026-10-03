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

  it('keeps memories from only the stations that ask for them', () => {
    const compiled = compileLine(
      withStation(1, { ...DELIVERY.stations[1], memories: true }),
    );

    expect(
      compiled.ok && compiled.line.stations.map((each) => each.memories),
    ).toEqual([false, true, false]);
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

  it('reads a station’s judge and its alerts in the order they were written', () => {
    const compiled = compileLine(
      withStation(1, {
        ...DELIVERY.stations[1],
        judge: { rubric: 'A good run is small.\n', sample: 0.2, trust: 0.6 },
        alerts: [
          { measure: 'sent_back_rate', risesBy: 0.2, over: 20 },
          { measure: 'cost_per_run', above: 2, over: 10 },
          { measure: 'accepted_rate', fallsBy: 0.1, over: 20 },
          { measure: 'merged_rate', below: 0.4, over: 20 },
        ],
      }),
    );
    const judged = compiled.ok ? compiled.line.stations[1] : undefined;

    expect(judged?.judge).toMatchObject({
      rubric: 'A good run is small.\n',
      sample: 0.2,
      trust: 0.6,
    });
    expect(judged?.alerts.map((each) => each.measure)).toEqual([
      'sent_back_rate',
      'cost_per_run',
      'accepted_rate',
      'merged_rate',
    ]);
    expect(judged?.alerts[2]).toMatchObject({ fallsBy: 0.1, risesBy: null });
    expect(judged?.alerts[3]).toMatchObject({ below: 0.4, above: null });
    expect(compiled.ok && compiled.line.stations[0]?.judge).toBeNull();
    expect(compiled.ok && compiled.line.stations[0]?.alerts).toEqual([]);
  });

  it('refuses a judge setting at its own path', () => {
    expect(
      refused(
        withStation(1, {
          ...DELIVERY.stations[1],
          judge: { rubric: 'A good run.', sample: 1.5, trust: 0.6 },
        }),
      )[0],
    ).toMatchObject({ field: FieldPath.dotted('stations.1.judge.sample') });
  });

  it('reads a judge of claims, and refuses one with neither a rubric nor claims at its rubric', () => {
    const compiled = compileLine(
      withStation(1, {
        ...DELIVERY.stations[1],
        judge: {
          claims: ['It adds a test.'],
          passShare: 1,
          sample: 0.2,
          trust: 0.6,
        },
      }),
    );

    expect(compiled.ok && compiled.line.stations[1]?.judge).toMatchObject({
      rubric: null,
      claims: ['It adds a test.'],
      passShare: 1,
    });
    expect(
      refused(
        withStation(1, {
          ...DELIVERY.stations[1],
          judge: { sample: 0.2, trust: 0.6 },
        }),
      )[0],
    ).toMatchObject({ field: FieldPath.dotted('stations.1.judge.rubric') });
    expect(
      refused(
        withStation(1, {
          ...DELIVERY.stations[1],
          judge: {
            claims: ['A claim.'],
            passShare: 2,
            sample: 0.2,
            trust: 0.6,
          },
        }),
      )[0],
    ).toMatchObject({ field: FieldPath.dotted('stations.1.judge.passShare') });
  });

  it('refuses an alert setting at its own path', () => {
    expect(
      refused(
        withStation(1, {
          ...DELIVERY.stations[1],
          alerts: [
            { measure: 'cost_per_run', above: 2, over: 10 },
            { measure: 'sent_back_rate', risesBy: -0.1, over: 20 },
          ],
        }),
      )[0],
    ).toMatchObject({ field: FieldPath.dotted('stations.1.alerts.1.risesBy') });
    expect(
      refused(
        withStation(1, {
          ...DELIVERY.stations[1],
          alerts: [{ measure: 'merged_rate', below: 1.5, over: 20 }],
        }),
      )[0],
    ).toMatchObject({ field: FieldPath.dotted('stations.1.alerts.0.below') });
  });

  it.each([
    ['no threshold', { measure: 'failed_rate', over: 5 }],
    [
      'two thresholds',
      { measure: 'accepted_rate', fallsBy: 0.1, below: 0.4, over: 5 },
    ],
  ])('refuses an alert with %s at the alert itself', (_, alert) => {
    expect(
      refused(
        withStation(1, {
          ...DELIVERY.stations[1],
          alerts: [alert],
        }),
      )[0],
    ).toMatchObject({ field: FieldPath.dotted('stations.1.alerts.0') });
  });

  it('refuses a judge or alerts at a station where nothing runs', () => {
    expect(
      refused(
        withStation(0, {
          ...DELIVERY.stations[0],
          judge: { rubric: 'A good run.', sample: 0.2, trust: 0.6 },
        }),
      )[0],
    ).toMatchObject({ field: FieldPath.dotted('stations.0.judge') });
    expect(
      refused(
        withStation(2, {
          ...DELIVERY.stations[2],
          alerts: [{ measure: 'failed_rate', above: 0.1, over: 5 }],
        }),
      )[0],
    ).toMatchObject({ field: FieldPath.dotted('stations.2.alerts') });
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

  it('reads where a line and its stations may run', () => {
    const compiled = compileLine({
      ...withStation(1, {
        ...DELIVERY.stations[1],
        runners: ['gpu'],
      }),
      runners: ['vpc-internal'],
    });

    expect(compiled.ok && compiled.line.placement.selectors).toEqual([
      'vpc-internal',
    ]);
    expect(
      compiled.ok && compiled.line.stations[1]?.placement.selectors,
    ).toEqual(['gpu']);
    expect(compiled.ok && compiled.line.stations[0]?.placement.isAnywhere).toBe(
      true,
    );
  });

  it('points at runners a station names twice', () => {
    expect(
      dottedOf(
        refused(
          withStation(1, { ...DELIVERY.stations[1], runners: ['gpu', 'gpu'] }),
        )[0]?.field,
      ),
    ).toBe('stations.1.runners');
  });

  it('points at an empty runner the line names', () => {
    expect(dottedOf(refused({ ...DELIVERY, runners: [' '] })[0]?.field)).toBe(
      'runners',
    );
  });

  it('reads the threshold a planned change is checked against, filling in what it leaves out', () => {
    const compiled = compileLine({
      ...DELIVERY,
      replayCheck: { mostRegressions: 2, currency: 'eur' },
    });

    expect(compiled.ok && compiled.line.replayCheck).toMatchObject({
      mostRegressions: 2,
      ceiling: 10,
      currency: 'EUR',
    });
    const unchecked = compileLine(DELIVERY);

    expect(unchecked.ok && unchecked.line.replayCheck).toBeNull();
  });

  it('points at the threshold setting it refuses', () => {
    expect(
      dottedOf(
        refused({ ...DELIVERY, replayCheck: { mostRegressions: 1.5 } })[0]
          ?.field,
      ),
    ).toBe('replayCheck.mostRegressions');
    expect(
      dottedOf(
        refused({ ...DELIVERY, replayCheck: { ceiling: 1_001 } })[0]?.field,
      ),
    ).toBe('replayCheck.ceiling');
    expect(
      dottedOf(
        refused({ ...DELIVERY, replayCheck: { currency: 'dollars' } })[0]
          ?.field,
      ),
    ).toBe('replayCheck.currency');
  });

  it('reads where the line’s Terraform lives, taking no source as none', () => {
    const compiled = compileLine({
      ...DELIVERY,
      source: { repository: 'acme/platform', path: 'teams/core/delivery.tf' },
    });

    expect(compiled.ok && compiled.line.source?.repository.value).toBe(
      'acme/platform',
    );
    expect(compiled.ok && compiled.line.source?.path).toBe(
      'teams/core/delivery.tf',
    );
    for (const unset of [DELIVERY, { ...DELIVERY, source: null }]) {
      const read = compileLine(unset);

      expect(read.ok && read.line.source).toBeNull();
    }
  });

  it('points at the source setting it refuses', () => {
    const at = (source: object) =>
      dottedOf(refused({ ...DELIVERY, source })[0]?.field);

    expect(at({ repository: 'platform', path: 'main.tf' })).toBe(
      'source.repository',
    );
    expect(at({ repository: 'acme/platform', path: '/main.tf' })).toBe(
      'source.path',
    );
    expect(at({ repository: 'acme/platform', path: 'teams/../main.tf' })).toBe(
      'source.path',
    );
    expect(at({ repository: 'acme/platform', path: 'teams/core.md' })).toBe(
      'source.path',
    );
    expect(at({ repository: 'acme/platform', path: 'teams//core.tf' })).toBe(
      'source.path',
    );
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

  it('refuses a station that checks its layers while a repository has no setup, pointing at that repository', () => {
    expect(
      refused({
        ...withStation(1, {
          key: 'code-review',
          name: 'Code Review',
          ends: true,
          check: 'npm test',
          diffs: true,
        }),
        repositories: [
          { name: 'acme/api', setup: 'npm ci' },
          { name: 'acme/web' },
        ],
      })[0],
    ).toMatchObject({
      path: 'lines/delivery',
      field: FieldPath.dotted('repositories.1.setup'),
    });
  });

  it('places a problem with a repository’s image at that repository', () => {
    expect(
      refused({
        ...DELIVERY,
        repositories: [{ name: 'acme/api', image: 'ghcr.io/acme/api:' }],
      })[0],
    ).toMatchObject({
      path: 'lines/delivery',
      field: FieldPath.dotted('repositories.0.image'),
    });
  });

  it('refuses what is not a line at all', () => {
    expect(refused('version: 1')[0]).toMatchObject({
      path: 'lines',
      field: FieldPath.root(),
    });
  });
});
