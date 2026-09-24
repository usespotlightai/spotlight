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
  harnessVersion: null,
  agentPrompt: null,
  check: null,
  setup: null,
  runners: [],
  diffs: false,
  decisions: false,
  finishes: false,
  ...over,
});

const ROWS: LineRows = {
  line: {
    key: 'delivery',
    name: 'Delivery',
    role: null,
    reviews: null,
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
  repositories: ['acme/api'],
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

  it('renders a definition that compiles', () => {
    expect(compileLine(renderLineRows(ROWS)).ok).toBe(true);
  });

  it('renders the text a station was defined with byte for byte, trailing newlines included', () => {
    const written = {
      description: 'Builds the change.\n',
      prompt: 'Implement the task.\n',
      check: 'npm test\n',
      setup: ' npm ci\n',
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
          setup: build?.setup?.value ?? null,
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
