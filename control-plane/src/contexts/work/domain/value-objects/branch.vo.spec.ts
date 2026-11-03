import { TaskId } from '@shared-kernel/domain/value-objects/task-id.vo';
import { InvalidBranchError } from '@work/domain/exceptions/invalid-branch.error';
import { Branch } from '@work/domain/value-objects/branch.vo';
import { TaskTitle } from '@work/domain/value-objects/task-title.vo';
import { describe, expect, it } from 'vitest';

const ID = TaskId.of('b38c669e-5194-453f-a68c-48183d11d301');

const named = (title: string): string =>
  Branch.for(ID, TaskTitle.of(title)).value;

describe('Branch', () => {
  it('names a task branch by type, title and short id', () => {
    expect(named('Add theme selector to the workspace menu')).toBe(
      'feat/add-theme-selector-to-the-workspace-menu-b38c669e',
    );
  });

  it('takes the type from a conventional title and drops the prefix', () => {
    expect(named('fix(SPO-123): Fit Cost Sankey labels to the card')).toBe(
      'fix/fit-cost-sankey-labels-to-the-card-b38c669e',
    );
    expect(named('docs: Explain branches')).toBe(
      'docs/explain-branches-b38c669e',
    );
  });

  it('takes the type from the first word', () => {
    expect(named('Fix the inbox badge')).toBe(
      'fix/fix-the-inbox-badge-b38c669e',
    );
    expect(named('Rename runner pools')).toBe(
      'refactor/rename-runner-pools-b38c669e',
    );
    expect(named('Add e2e tests for replays')).toBe(
      'test/add-e2e-tests-for-replays-b38c669e',
    );
    expect(named('Bump vitest')).toBe('chore/bump-vitest-b38c669e');
  });

  it('names a feature where the title gives no type', () => {
    expect(named('Equalise Cost slice card heights')).toBe(
      'feat/equalise-cost-slice-card-heights-b38c669e',
    );
  });

  it('cuts a long title at a word', () => {
    expect(
      named(
        'Show the station thread at the run and follow the latest run on every page',
      ),
    ).toBe('feat/show-the-station-thread-at-the-run-and-b38c669e');
  });

  it('keeps only plain letters and digits', () => {
    expect(named('Café “menü” & the 2nd tab!')).toBe(
      'feat/cafe-menu-the-2nd-tab-b38c669e',
    );
    expect(named('✨🚀')).toBe('feat/task-b38c669e');
  });

  it('refuses an empty name', () => {
    expect(() => Branch.of(' ')).toThrow(InvalidBranchError);
  });
});
