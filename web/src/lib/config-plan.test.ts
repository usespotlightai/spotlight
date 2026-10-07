import { describe, expect, it } from 'vitest';
import { configPlan, planTextLines } from '@/lib/config-plan';
import type { ConfigChange } from '@/lib/station-config';

const change = (over: Partial<ConfigChange>): ConfigChange => ({
  part: 'model',
  name: null,
  kind: 'changed',
  was: null,
  now: null,
  ...over,
});

describe('configPlan', () => {
  it('reads a changed setting as an attribute going from one value to another', () => {
    expect(configPlan([change({ was: 'sonnet', now: 'opus' })])).toEqual([
      {
        kind: 'leaf',
        id: 'model:',
        mark: 'changed',
        name: 'model',
        was: '"sonnet"',
        now: '"opus"',
        note: null,
      },
    ]);
  });

  it('gathers skills into one list, each marked by what happened to it', () => {
    const [skills] = configPlan([
      change({ part: 'skill', name: 'grafana', kind: 'removed' }),
      change({ part: 'skill', name: 'our-migrations', kind: 'added' }),
    ]);

    expect(skills).toMatchObject({
      kind: 'group',
      name: 'skills',
      list: true,
      leaves: [
        { mark: 'removed', now: '"grafana",' },
        { mark: 'added', now: '"our-migrations",' },
      ],
    });
  });

  it('gathers judge settings into a block, leaving numbers bare', () => {
    const [judge] = configPlan([
      change({ part: 'judge', name: 'sample', was: '0.1', now: '0.2' }),
    ]);

    expect(judge).toMatchObject({
      kind: 'group',
      name: 'judge',
      list: false,
      leaves: [{ name: 'sample', was: '0.1', now: '0.2' }],
    });
  });

  it('reads a value of several lines as text, line by line', () => {
    const [prompt] = configPlan([
      change({ part: 'prompt', was: 'One.\nTwo.', now: 'One.\nThree.' }),
    ]);

    expect(prompt).toMatchObject({
      kind: 'text',
      name: 'prompt',
      lines: [
        { mark: null, text: 'One.' },
        { mark: 'removed', text: 'Two.' },
        { mark: 'added', text: 'Three.' },
      ],
    });
  });
});

describe('planTextLines', () => {
  it('keeps two lines around each change and counts the rest as hidden', () => {
    const was = ['a', 'b', 'c', 'd', 'e', 'f', 'g'].join('\n');
    const now = ['a', 'b', 'c', 'd', 'e', 'f', 'G'].join('\n');

    expect(planTextLines(was, now)).toEqual([
      { hidden: 4 },
      { mark: null, text: 'e' },
      { mark: null, text: 'f' },
      { mark: 'removed', text: 'g' },
      { mark: 'added', text: 'G' },
    ]);
  });
});
