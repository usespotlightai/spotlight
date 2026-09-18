import { ConfigurationFile } from '@shared-kernel/domain/value-objects/configuration-file.vo';
import { TeamId } from '@shared-kernel/domain/value-objects/team-id.vo';
import { WorkspaceId } from '@shared-kernel/domain/value-objects/workspace-id.vo';
import { Line } from '@work/domain/aggregates/line.aggregate';
import { BUILT_IN_LINES } from '@work/domain/services/built-in-lines';
import { LineRole } from '@work/domain/value-objects/line-role.vo';
import { compileLine } from '@work/infrastructure/lines/line.compile';
import { renderLine } from '@work/infrastructure/lines/line.render';
import { describe, expect, it } from 'vitest';

const STATIONS = [
  ConfigurationFile.of(
    '.spotlight/lines/review/stations/backlog.md',
    '---\nname: Backlog\nkind: backlog\n---\n',
  ),
  ConfigurationFile.of(
    '.spotlight/lines/review/stations/code-review.md',
    '---\nname: Review\nharness: dev\ndiffs: true\n---\nReview it.\n',
  ),
  ConfigurationFile.of(
    '.spotlight/lines/review/stations/completed.md',
    '---\nname: Completed\nkind: completed\n---\n',
  ),
];

const compiled = (reviews: string, role = 'review') =>
  compileLine('review', [
    ConfigurationFile.of(
      '.spotlight/lines/review/line.yml',
      `version: 1
name: Review
role: ${role}
stations: [backlog, code-review, completed]
${reviews}`,
    ),
    ...STATIONS,
  ]);

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

    expect(line.ok).toBe(false);
    expect(line.problems.map((each) => each.at)).toEqual(['reviews']);
  });

  it('refuses a review that starts on anything else', () => {
    const line = compiled('reviews:\n  start: pushed\n');

    expect(line.ok).toBe(false);
    expect(line.problems.map((each) => each.at)).toEqual(['reviews.start']);
  });

  it('refuses a mention that is not a handle', () => {
    const line = compiled('reviews:\n  mention: spotlight\n');

    expect(line.ok).toBe(false);
    expect(line.problems.map((each) => each.at)).toEqual(['reviews']);
  });

  it('writes the built-in review line out and reads the same reviews back', () => {
    const opening = BUILT_IN_LINES.find((each) =>
      each.role?.equals(LineRole.REVIEW),
    );
    let next = 0;
    const line = Line.open({
      workspaceId: WorkspaceId.of('ws_1'),
      teamId: TeamId.of('team_1'),
      // biome-ignore lint/style/noNonNullAssertion: Spotlight ships a review line
      line: opening!,
      newId: () => `id_${++next}`,
    });
    const back = compileLine('review', renderLine(line));

    if (!back.ok) {
      throw new Error(back.problems.map((each) => each.reason).join(', '));
    }

    expect(line.reviews).not.toBeNull();
    // biome-ignore lint/style/noNonNullAssertion: checked just above
    expect(back.line.reviews?.equals(line.reviews!)).toBe(true);
    expect(
      back.line.stations.find((each) => each.key.value === 'code-review')
        ?.diffs,
    ).toBe(true);
  });
});
