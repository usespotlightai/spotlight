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
  agentPrompt: null,
  check: null,
  setup: null,
  diffs: false,
  decisions: false,
  finishes: false,
  ...over,
});

const ROWS: LineRows = {
  line: { key: 'delivery', name: 'Delivery', role: null, reviews: null },
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

  it('renders a definition that compiles', () => {
    expect(compileLine(renderLineRows(ROWS)).ok).toBe(true);
  });
});
