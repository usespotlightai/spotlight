import { describe, expect, it } from 'vitest';
import type { InboxItem, InboxMessage } from '@/lib/inbox';
import { inboxItemPath, previewOf, shownAt, spentOn } from '@/lib/inbox';

const note = (position: number, runId: string | null) =>
  ({ position, runId }) as InboxMessage;

const notes = [note(11, 'run_1'), note(12, null), note(13, 'run_2')];

describe('inboxItemPath', () => {
  it('addresses the conversation on its own', () => {
    expect(inboxItemPath('acme', 'task_1:11')).toBe(
      '/w/acme/inbox/task_1%3A11',
    );
  });

  it('carries the run it was followed from', () => {
    expect(inboxItemPath('acme', 'task_1:11', 'run_2')).toBe(
      '/w/acme/inbox/task_1%3A11?run=run_2',
    );
  });
});

describe('shownAt', () => {
  it('finds where in the conversation that run asked', () => {
    expect(shownAt(notes, 'run_2')).toBe(13);
  });

  it('opens on nothing in particular where no run was named', () => {
    expect(shownAt(notes, null)).toBeNull();
  });

  it('opens on nothing in particular for a run that said nothing here', () => {
    expect(shownAt(notes, 'run_9')).toBeNull();
  });
});

describe('spentOn', () => {
  it('keeps enough of a small cost to still be a number', () => {
    expect(spentOn(0.0042)).toBe('$0.0042');
    expect(spentOn(7.3269)).toBe('$7.33');
  });

  it('says nothing where the harness reported nothing', () => {
    expect(spentOn(null)).toBe('–');
  });
});

describe('previewOf', () => {
  const item = (notes: Partial<InboxMessage>[]) =>
    ({
      station: 'Planning',
      description: 'A few quick steps will get everything ready.',
      notes,
    }) as InboxItem;

  it('shows the last thing said', () => {
    expect(previewOf(item([{ form: 'words', body: 'Which queue?' }]))).toBe(
      'Which queue?',
    );
  });

  it('shows the task’s description, not the listed steps, for setting up a team', () => {
    expect(
      previewOf(item([{ form: 'setup', body: '1. [Connect GitHub](/x). …' }])),
    ).toBe('A few quick steps will get everything ready.');
  });

  it('says where it waits when nothing has been said', () => {
    expect(previewOf(item([]))).toBe('Waiting at Planning');
  });
});
