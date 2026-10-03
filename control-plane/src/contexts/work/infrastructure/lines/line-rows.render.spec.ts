import { compileLine } from '@work/infrastructure/lines/line.compile';
import {
  type LineRows,
  renderLineRows,
} from '@work/infrastructure/lines/line-rows.render';
import { describe, expect, it } from 'vitest';

const station = (
  id: string,
  over: Partial<LineRows['stations'][number]> = {},
): LineRows['stations'][number] => ({
  id,
  key: id,
  name: id,
  kind: 'work',
  color: '#a3a8b0',
  description: null,
  harness: null,
  model: null,
  effort: null,
  profile: null,
  agentPrompt: null,
  check: null,
  runners: [],
  diffs: false,
  decisions: false,
  memories: false,
  judge: null,
  alerts: [],
  finishes: false,
  ...over,
});

const ROWS: LineRows = {
  line: {
    key: 'delivery',
    name: 'Delivery',
    role: null,
    reviews: null,
    replayCheck: null,
    source: null,
    runners: [],
  },
  stations: [
    station('backlog', { kind: 'backlog' }),
    station('build', {
      harness: 'claude-code',
      agentPrompt: 'Build it.',
      finishes: true,
    }),
    station('completed', { kind: 'completed' }),
  ],
  routes: [{ stationId: 'backlog', toStationId: 'build' }],
  tools: [{ stationId: 'build', name: 'linear.comment' }],
  skills: [{ stationId: 'build', name: 'grafana' }],
  reactions: [
    {
      happening: 'github.pull_request.merged',
      fromStationId: null,
      toStationId: 'completed',
    },
  ],
  repositories: [{ repository: 'acme/api', image: null, setup: null }],
};

describe('renderLineRows', () => {
  it('renders a line as a definition, naming stations by key', () => {
    const rendered = renderLineRows(ROWS);

    expect(rendered.stations.map((each) => each.passesTo)).toEqual([
      ['build'],
      [],
      [],
    ]);
    expect(rendered.stations[1]).toMatchObject({
      harness: 'claude-code',
      prompt: 'Build it.',
      tools: ['linear.comment'],
      skills: ['grafana'],
      ends: true,
    });
    expect(rendered.reactions).toEqual([
      { happening: 'github.pull_request.merged', to: 'completed' },
    ]);
  });

  it('renders the threshold a planned change is checked against only where the line has one', () => {
    const rendered = renderLineRows({
      ...ROWS,
      line: {
        ...ROWS.line,
        replayCheck: {
          mostRegressions: 1,
          ceiling: 12.5,
          currency: 'USD',
          minGain: 0.05,
        },
      },
    });

    expect(rendered.replayCheck).toEqual({
      mostRegressions: 1,
      ceiling: 12.5,
      currency: 'USD',
      minGain: 0.05,
    });
    expect(Object.keys(renderLineRows(ROWS))).not.toContain('replayCheck');
    expect(compileLine(rendered).ok).toBe(true);
  });

  it('renders where the line’s Terraform lives only where it says', () => {
    const rendered = renderLineRows({
      ...ROWS,
      line: {
        ...ROWS.line,
        source: { repository: 'acme/platform', path: 'teams/core.tf' },
      },
    });

    expect(rendered.source).toEqual({
      repository: 'acme/platform',
      path: 'teams/core.tf',
    });
    expect(Object.keys(renderLineRows(ROWS))).not.toContain('source');
    expect(compileLine(rendered).ok).toBe(true);
  });

  it('leaves out what a station does not have', () => {
    expect(Object.keys(renderLineRows(ROWS).stations[0] ?? {})).not.toContain(
      'harness',
    );
  });

  it('renders where a line and its stations may run, and leaves it out when anywhere', () => {
    const rendered = renderLineRows({
      ...ROWS,
      line: { ...ROWS.line, runners: ['vpc-internal'] },
      stations: [
        ...ROWS.stations.slice(0, 1),
        station('build', { runners: ['gpu'], finishes: true }),
        ...ROWS.stations.slice(2),
      ],
    });

    expect(rendered.runners).toEqual(['vpc-internal']);
    expect(rendered.stations[1]?.runners).toEqual(['gpu']);
    expect(Object.keys(rendered.stations[0] ?? {})).not.toContain('runners');
    expect(Object.keys(renderLineRows(ROWS))).not.toContain('runners');
    expect(compileLine(rendered).ok).toBe(true);
  });

  it('renders a judge only where there is one, and alerts in their order with only the threshold they set', () => {
    const rendered = renderLineRows({
      ...ROWS,
      stations: [
        ...ROWS.stations.slice(0, 1),
        station('build', {
          finishes: true,
          judge: { rubric: 'A good run is small.\n', sample: 0.2, trust: 0.6 },
          alerts: [
            {
              measure: 'sent_back_rate',
              risesBy: 0.2,
              above: null,
              fallsBy: null,
              below: null,
              over: 20,
            },
            {
              measure: 'cost_per_run',
              risesBy: null,
              above: 2,
              fallsBy: null,
              below: null,
              over: 10,
            },
            {
              measure: 'accepted_rate',
              risesBy: null,
              above: null,
              fallsBy: 0.1,
              below: null,
              over: 20,
            },
            {
              measure: 'merged_rate',
              risesBy: null,
              above: null,
              fallsBy: null,
              below: 0.4,
              over: 20,
            },
          ],
        }),
        ...ROWS.stations.slice(2),
      ],
    });

    expect(rendered.stations[1]?.judge).toEqual({
      rubric: 'A good run is small.\n',
      sample: 0.2,
      trust: 0.6,
    });
    expect(rendered.stations[1]?.alerts).toEqual([
      { measure: 'sent_back_rate', risesBy: 0.2, over: 20 },
      { measure: 'cost_per_run', above: 2, over: 10 },
      { measure: 'accepted_rate', fallsBy: 0.1, over: 20 },
      { measure: 'merged_rate', below: 0.4, over: 20 },
    ]);
    expect(Object.keys(rendered.stations[0] ?? {})).not.toContain('judge');
    expect(rendered.stations[0]?.alerts).toEqual([]);
    expect(compileLine(rendered).ok).toBe(true);
  });

  it('renders routes and reactions in station order, whatever order they were read in', () => {
    const rendered = renderLineRows({
      ...ROWS,
      routes: [
        { stationId: 'backlog', toStationId: 'completed' },
        { stationId: 'backlog', toStationId: 'build' },
      ],
      reactions: [
        {
          happening: 'github.pull_request.merged',
          fromStationId: 'build',
          toStationId: 'completed',
        },
        {
          happening: 'github.checks.failed',
          fromStationId: 'completed',
          toStationId: 'build',
        },
        {
          happening: 'github.pull_request.merged',
          fromStationId: null,
          toStationId: 'completed',
        },
      ],
    });

    expect(rendered.stations[0]?.passesTo).toEqual(['build', 'completed']);
    expect(rendered.reactions).toEqual([
      { happening: 'github.checks.failed', from: 'completed', to: 'build' },
      { happening: 'github.pull_request.merged', to: 'completed' },
      {
        happening: 'github.pull_request.merged',
        from: 'build',
        to: 'completed',
      },
    ]);
  });

  it('renders repositories in code point order, whatever order they were read in', () => {
    const rendered = renderLineRows({
      ...ROWS,
      repositories: [
        { repository: 'acme/web', image: null, setup: null },
        { repository: 'acme/api', image: null, setup: null },
      ],
    });

    expect(rendered.repositories).toEqual([
      { name: 'acme/api' },
      { name: 'acme/web' },
    ]);
  });

  it('renders the image and setup a repository names, and compiles back to the same', () => {
    const rendered = renderLineRows({
      ...ROWS,
      repositories: [
        {
          repository: 'acme/web',
          image: 'ghcr.io/acme/app:1',
          setup: 'pnpm install\n',
        },
        { repository: 'acme/api', image: 'ghcr.io/acme/app:1', setup: null },
      ],
    });

    expect(rendered.repositories).toEqual([
      { name: 'acme/api', image: 'ghcr.io/acme/app:1' },
      {
        name: 'acme/web',
        image: 'ghcr.io/acme/app:1',
        setup: 'pnpm install\n',
      },
    ]);

    const compiled = compileLine(rendered);

    expect(compiled.ok).toBe(true);
    if (compiled.ok) {
      expect(compiled.line.repositories.image?.value).toBe(
        'ghcr.io/acme/app:1',
      );
      expect(
        compiled.line.repositories.entries.map((each) => ({
          name: each.repository.value,
          setup: each.setup?.value ?? null,
        })),
      ).toEqual([
        { name: 'acme/api', setup: null },
        { name: 'acme/web', setup: 'pnpm install\n' },
      ]);
    }
  });

  it('renders a definition that compiles', () => {
    expect(compileLine(renderLineRows(ROWS)).ok).toBe(true);
  });

  it('renders the text a station was defined with byte for byte, trailing newlines included', () => {
    const written = {
      description: 'Builds the change.\n',
      prompt: 'Implement the task.\n',
      check: 'npm test\n',
    };
    const compiled = compileLine({
      key: 'delivery',
      name: 'Delivery',
      stations: [
        {
          key: 'backlog',
          name: 'Backlog',
          kind: 'backlog',
          passesTo: ['build'],
        },
        { key: 'build', name: 'Build', ends: true, ...written },
        { key: 'completed', name: 'Completed', kind: 'completed' },
      ],
    });
    const build = compiled.ok ? compiled.line.stations[1] : undefined;
    const rendered = renderLineRows({
      ...ROWS,
      stations: [
        station('build', {
          description: build?.description?.value ?? null,
          agentPrompt: build?.agentPrompt?.value ?? null,
          check: build?.check?.value ?? null,
          finishes: true,
        }),
      ],
      routes: [],
      tools: [],
      skills: [],
      reactions: [],
    });

    expect(rendered.stations[0]).toMatchObject(written);
  });
});
