import { FieldPath } from '@shared-kernel/domain/value-objects/field-path.vo';
import { compileLine } from '@work/infrastructure/lines/line.compile';
import { describe, expect, it } from 'vitest';
import { parse as parseYaml } from 'yaml';

const STATIONS = [
  { key: 'backlog', name: 'Backlog', kind: 'backlog' },
  {
    key: 'code-review',
    name: 'Review',
    harness: 'dev',
    diffs: true,
    prompt: 'Review it.',
  },
  { key: 'completed', name: 'Completed', kind: 'completed' },
];

const compiled = (reviews: string, role = 'review') =>
  compileLine({
    key: 'review',
    name: 'Review',
    role,
    stations: STATIONS,
    ...(parseYaml(reviews) ?? {}),
  });

const read = (reviews: string) => {
  const line = compiled(reviews);

  if (!line.ok) {
    throw new Error(line.problems.map((each) => each.reason).join(', '));
  }

  return line.line;
};

describe('the pull requests a line reviews', () => {
  it('reads when a review starts, what mentions it, and what it skips', () => {
    const { reviews } = read(`reviews:
  start: opened
  mention: '@reviewer'
  skip:
    spotlight: false
    drafts: true
    authors: ['dependabot[bot]']
`);

    expect(reviews?.start).toBe('opened');
    expect(reviews?.mention).toBe('@reviewer');
    expect(reviews?.skip).toEqual({
      spotlight: false,
      drafts: true,
      authors: ['dependabot[bot]'],
    });
  });

  it('reviews nothing where the line says nothing of reviews', () => {
    expect(read('').reviews).toBeNull();
  });

  it('refuses reviews on a line whose role is not review', () => {
    const line = compiled('reviews:\n  start: opened\n', 'delivery');

    expect(line).toMatchObject({
      ok: false,
      problems: [{ field: FieldPath.dotted('reviews') }],
    });
  });

  it('refuses a review that starts on anything else', () => {
    const line = compiled('reviews:\n  start: pushed\n');

    expect(line).toMatchObject({
      ok: false,
      problems: [{ field: FieldPath.dotted('reviews.start') }],
    });
  });

  it('refuses a mention that is not a handle', () => {
    const line = compiled('reviews:\n  mention: spotlight\n');

    expect(line).toMatchObject({
      ok: false,
      problems: [{ field: FieldPath.dotted('reviews') }],
    });
  });
});
