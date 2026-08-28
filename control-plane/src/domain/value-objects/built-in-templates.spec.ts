import {
  BUILT_IN_TEMPLATES,
  DEFAULT_TEMPLATE,
} from '@domain/value-objects/built-in-templates';
import { describe, expect, it } from 'vitest';

describe('built-in templates', () => {
  it('opens a board on backlog, triage, spec, implementation and review', () => {
    expect(DEFAULT_TEMPLATE.stations.map((each) => each.name.value)).toEqual([
      'Backlog',
      'Triage',
      'Spec',
      'Implementation',
      'Code Review',
    ]);
  });

  it('names the line the default template creates', () => {
    expect(DEFAULT_TEMPLATE.name.value).toBe('Default');
  });

  it('gives every station a colour to open with', () => {
    expect(
      DEFAULT_TEMPLATE.stations.every((each) => each.color.value.length === 7),
    ).toBe(true);
  });

  it('offers the default among the catalogue', () => {
    expect(BUILT_IN_TEMPLATES).toContain(DEFAULT_TEMPLATE);
  });

  it('gives every template in the catalogue an id of its own', () => {
    const ids = BUILT_IN_TEMPLATES.map((each) => each.id.value);

    expect(new Set(ids).size).toBe(ids.length);
  });
});
