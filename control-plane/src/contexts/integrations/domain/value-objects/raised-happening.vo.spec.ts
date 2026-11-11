import { UnplaceableHappeningError } from '@integrations/domain/exceptions/unplaceable-happening.error';
import { DeclaredHappening } from '@integrations/domain/value-objects/declared-happening.vo';
import { HappeningName } from '@integrations/domain/value-objects/happening-name.vo';
import { MarkKind } from '@integrations/domain/value-objects/mark-kind.vo';
import { Opening } from '@integrations/domain/value-objects/opening.vo';
import { describe, expect, it } from 'vitest';

const ISSUE = MarkKind.of('linear.issue');
const THREAD = MarkKind.of('linear.thread');

const declared = (opens: Opening | null = null) =>
  DeclaredHappening.of({
    happening: HappeningName.of('linear.issue_created'),
    label: 'Issue created',
    summary: 'An issue was created.',
    finds: [ISSUE],
    findsByBranch: true,
    opens,
  });

describe('RaisedHappening', () => {
  it('finds its task by the marks that find one, keeping the others to carry', () => {
    const raised = declared().raised({
      branch: null,
      marks: [
        { kind: ISSUE, value: 'ENG-1', finds: true },
        { kind: THREAD, value: 't-1', finds: false },
      ],
      opening: null,
    });

    expect(raised.finding.map((each) => each.value)).toEqual(['ENG-1']);
    expect(raised.marks).toHaveLength(2);
  });

  it('cannot be placed when it names neither a branch nor a mark that finds a task', () => {
    expect(() =>
      declared().raised({
        branch: '',
        marks: [
          { kind: ISSUE, value: '', finds: true },
          { kind: THREAD, value: 't-1', finds: false },
        ],
        opening: null,
      }),
    ).toThrow(UnplaceableHappeningError);
  });

  it('is placed by its branch alone', () => {
    expect(
      declared().raised({ branch: 'feat/a', marks: [], opening: null }).branch,
    ).toBe('feat/a');
  });

  it('opens a task only where its happening opens one and it has a title', () => {
    const opening = Opening.of({ lineRole: 'delivery' });
    const raise = (title: string | null, opens: Opening | null) =>
      declared(opens).raised({
        branch: 'feat/a',
        marks: [],
        opening: { title, description: null, assignEmail: null },
      }).opens;

    expect(raise('Fix it', opening)).toEqual({
      opening,
      title: 'Fix it',
      description: null,
      assignEmail: null,
    });
    expect(raise(null, opening)).toBeNull();
    expect(raise('Fix it', null)).toBeNull();
  });
});
