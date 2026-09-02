import { describe, expect, it } from 'vitest';
import type { InboxMessage } from '@/lib/inbox';
import { inboxItemPath, shownAt, spentOn } from '@/lib/inbox';

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
  // A cent is where rounding starts hiding what a run actually cost.
  it('keeps enough of a small cost to still be a number', () => {
    expect(spentOn(0.0042)).toBe('$0.0042');
    expect(spentOn(7.3269)).toBe('$7.33');
  });

  it('says nothing where the harness reported nothing', () => {
    expect(spentOn(null)).toBe('–');
  });
});
