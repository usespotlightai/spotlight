import { StationToolsMapper } from '@lines/application/mappers/station-tools.mapper';
import { describe, expect, it } from 'vitest';

const SKILL_TOOLS = new Map([
  ['research', ['catalog.web-search@1.1.0', 'grep']],
  ['review', ['grep', 'linear.comment']],
]);

describe('StationToolsMapper', () => {
  it('lists the station’s own tools in station order', () => {
    expect(
      StationToolsMapper.toDtos(['pull-request', 'grep'], [], new Map()),
    ).toEqual([
      {
        value: 'pull-request',
        called: 'pull-request',
        origin: 'built-in',
      },
      {
        value: 'grep',
        called: 'grep',
        origin: 'built-in',
      },
    ]);
  });

  it('lists a tool only a skill brings, with the origin and called name', () => {
    expect(
      StationToolsMapper.toDtos(
        [],
        ['research', 'review'],
        new Map([
          ['research', ['catalog.web-search@1.1.0']],
          ['review', ['linear.comment']],
        ]),
      ),
    ).toEqual([
      {
        value: 'catalog.web-search@1.1.0',
        called: 'catalog.web-search',
        origin: 'catalog',
      },
      {
        value: 'linear.comment',
        called: 'linear.comment',
        origin: 'integration',
      },
    ]);
  });

  it('shows a tool once when the station sets it and a skill brings it', () => {
    expect(
      StationToolsMapper.toDtos(['grep'], ['research'], SKILL_TOOLS),
    ).toEqual([
      {
        value: 'grep',
        called: 'grep',
        origin: 'built-in',
      },
      expect.objectContaining({ value: 'catalog.web-search@1.1.0' }),
    ]);
  });

  it('shows a tool once when two skills bring it', () => {
    expect(
      StationToolsMapper.toDtos([], ['research', 'review'], SKILL_TOOLS).map(
        (each) => each.value,
      ),
    ).toEqual(['catalog.web-search@1.1.0', 'grep', 'linear.comment']);
  });

  it('orders skill tools by the station’s skills, then each skill’s tools', () => {
    expect(
      StationToolsMapper.toDtos([], ['review', 'research'], SKILL_TOOLS).map(
        (each) => each.value,
      ),
    ).toEqual(['grep', 'linear.comment', 'catalog.web-search@1.1.0']);
  });

  it('returns nothing when the station has no tools and no skill brings any', () => {
    expect(StationToolsMapper.toDtos([], ['missing'], new Map())).toEqual([]);
  });
});
