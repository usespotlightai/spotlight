import {
  SEARCHABLE_FIELDS,
  unsearchableChanges,
} from '@replays/domain/services/searchable-changes';
import { StationBlock } from '@replays/domain/value-objects/station-block.vo';
import { describe, expect, it } from 'vitest';

const SEED = {
  key: 'build',
  name: 'Build',
  kind: 'work',
  prompt: 'Build it.',
  harness: 'claude-code',
  model: 'sonnet',
  effort: 'medium',
  skills: [{ key: 'tests' }],
  tools: ['github'],
  decisions: false,
  memories: true,
  alerts: [{ when: 'failed', notify: 'slack' }],
  passesTo: ['ship'],
  ends: false,
  judge: { rubric: 'scores: 1-5', sample: 0.1, minAgreement: 0.6 },
  check: 'npm test',
};

const changed = (part: Record<string, unknown>) =>
  unsearchableChanges(
    StationBlock.of(SEED),
    StationBlock.of({ ...SEED, ...part }),
  );

describe('unsearchableChanges', () => {
  it('lets a search change any searchable field', () => {
    expect(
      changed({
        prompt: 'Build it, briefly.',
        harness: 'codex',
        model: 'gpt',
        effort: 'high',
        profile: { key: 'fast' },
        skills: [],
        tools: ['github', 'linear'],
        decisions: true,
        memories: false,
        description: 'Builds.',
      }),
    ).toEqual([]);
    expect(SEARCHABLE_FIELDS).toHaveLength(10);
  });

  it.each([
    ['name', 'Make'],
    ['kind', 'review'],
    ['alerts', []],
    ['passesTo', ['completed']],
    ['ends', true],
    ['judge', { rubric: 'scores: 1-5', sample: 1, minAgreement: 0.6 }],
    ['check', 'npm run lint'],
    ['runners', { pool: 'gpu' }],
  ])('rejects a change to %s, naming its path', (field, value) => {
    const problems = changed({ [field]: value });

    expect(problems).toHaveLength(1);
    expect(problems[0]?.field.segments).toEqual(['station', field]);
    expect(problems[0]?.reason).toContain(field);
  });

  it('rejects taking away a field the live config has', () => {
    const { judge: _, ...withoutJudge } = SEED;

    expect(
      unsearchableChanges(
        StationBlock.of(SEED),
        StationBlock.of(withoutJudge),
      ).map((each) => each.field.segments),
    ).toEqual([['station', 'judge']]);
  });

  it('ignores the order of keys, never of lists', () => {
    expect(
      changed({
        judge: { minAgreement: 0.6, sample: 0.1, rubric: 'scores: 1-5' },
      }),
    ).toEqual([]);
    expect(changed({ passesTo: ['ship', 'completed'] })).toHaveLength(1);
  });

  it('names every unsearchable change at once', () => {
    expect(
      changed({ name: 'Make', ends: true, prompt: 'Go' }).map((each) =>
        each.field.segments.join('.'),
      ),
    ).toEqual(['station.ends', 'station.name']);
  });
});
