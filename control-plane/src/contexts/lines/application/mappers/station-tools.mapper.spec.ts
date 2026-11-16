import { StationToolsMapper } from '@lines/application/mappers/station-tools.mapper';
import { describe, expect, it } from 'vitest';

const SKILL_TOOLS = new Map([
  ['research', ['catalog.web-search@1.1.0', 'grep']],
  ['review', ['grep', 'linear.comment']],
]);

describe('StationToolsMapper', () => {
  it('lists the station’s own tools as direct, in station order', () => {
    expect(
      StationToolsMapper.toDtos(['pull-request', 'grep'], [], new Map()),
    ).toEqual([
      {
        value: 'pull-request',
        called: 'pull-request',
        origin: 'built-in',
        direct: true,
        skills: [],
      },
      {
        value: 'grep',
        called: 'grep',
        origin: 'built-in',
        direct: true,
        skills: [],
      },
    ]);
  });

  it('lists a tool only a skill brings as not direct, with the origin and called name', () => {
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
        direct: false,
        skills: ['research'],
      },
      {
        value: 'linear.comment',
        called: 'linear.comment',
        origin: 'integration',
        direct: false,
        skills: ['review'],
      },
    ]);
  });

  it('shows a tool once as direct when a skill brings it too', () => {
    expect(
      StationToolsMapper.toDtos(['grep'], ['research'], SKILL_TOOLS),
    ).toEqual([
      {
        value: 'grep',
        called: 'grep',
        origin: 'built-in',
        direct: true,
        skills: ['research'],
      },
      expect.objectContaining({ value: 'catalog.web-search@1.1.0' }),
    ]);
  });

  it('names every skill that brings the same tool, once each', () => {
    const [search, grep, comment] = StationToolsMapper.toDtos(
      [],
      ['research', 'review', 'research'],
      SKILL_TOOLS,
    );

    expect(search.skills).toEqual(['research']);
    expect(grep.skills).toEqual(['research', 'review']);
    expect(comment.skills).toEqual(['review']);
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
