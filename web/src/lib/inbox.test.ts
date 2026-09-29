import { describe, expect, it } from 'vitest';
import type {
  InboxItem,
  InboxMessage,
  JournalStep,
  RunJournal,
} from '@/lib/inbox';
import {
  decisionOwed,
  inboxItemPath,
  previewOf,
  shownAt,
  spentOn,
  workedOn,
} from '@/lib/inbox';

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

describe('decisionOwed', () => {
  const asked = (form: InboxMessage['form']) =>
    ({ kind: 'asked', form }) as InboxMessage;

  it('owes a decision where the last question put up an approval', () => {
    expect(decisionOwed([asked('words'), asked('approval')])).toBe(true);
  });

  it('owes only an answer where the last question was put in words', () => {
    expect(decisionOwed([asked('approval'), asked('words')])).toBe(false);
    expect(decisionOwed([])).toBe(false);
  });
});

describe('workedOn', () => {
  const at = (minute: number) =>
    new Date(Date.UTC(2026, 8, 29, 9, minute)).toISOString();

  const step = (text: string, minute: number) =>
    ({ text, startedAt: at(minute), ms: 30_000 }) as JournalStep;

  const journal = (
    attempt: number,
    steps: JournalStep[],
    began: number | null = null,
  ) =>
    ({
      runId: 'run_1',
      attempt,
      steps,
      ms: 600_000,
      marks: { startedAt: began === null ? null : at(began) },
    }) as RunJournal;

  const said = (
    voice: InboxMessage['voice'],
    minute: number,
    runId: string | null = voice === 'person' ? null : 'run_1',
  ) => ({ voice, runId, at: at(minute) }) as InboxMessage;

  const texts = (journals: RunJournal[]) =>
    journals.flatMap((each) => each.steps.map((one) => one.text));

  it('hands a run that asked nobody everything it did', () => {
    const worked = [journal(1, [step('read', 1), step('edit', 2)])];

    expect(workedOn(worked, [said('station', 5)], 'run_1')).toEqual(worked);
  });

  it('keeps other runs out of it', () => {
    const worked = [
      journal(1, [step('read', 1)]),
      { ...journal(1, [step('elsewhere', 1)]), runId: 'run_2' },
    ];

    expect(texts(workedOn(worked, [], 'run_1'))).toEqual(['read']);
  });

  it('gives the question what the run did before the person answered', () => {
    const worked = [journal(1, [step('before', 1), step('after', 20)])];
    const notes = [said('station', 5), said('person', 10)];

    expect(texts(workedOn(worked, notes, 'run_1', at(5)))).toEqual(['before']);
  });

  it('gives what it goes on to do only what came after the answer', () => {
    const worked = [journal(1, [step('before', 1), step('after', 20)])];
    const notes = [said('station', 5), said('person', 10)];

    expect(texts(workedOn(worked, notes, 'run_1'))).toEqual(['after']);
    expect(texts(workedOn(worked, notes, 'run_1', at(25)))).toEqual(['after']);
  });

  it('splits at an answer that came from Slack as it does at one typed here', () => {
    const worked = [journal(1, [step('before', 1), step('after', 20)])];
    const notes = [
      said('station', 5),
      {
        voice: 'world',
        kind: 'answered',
        runId: null,
        at: at(10),
      } as InboxMessage,
    ];

    expect(texts(workedOn(worked, notes, 'run_1', at(5)))).toEqual(['before']);
    expect(texts(workedOn(worked, notes, 'run_1'))).toEqual(['after']);
  });

  it('times a split attempt by the steps it kept', () => {
    const worked = [journal(1, [step('before', 1), step('after', 20)])];
    const notes = [said('station', 5), said('person', 10)];

    expect(workedOn(worked, notes, 'run_1')[0]?.ms).toBe(30_000);
  });

  it('keeps each attempt of a parked run on its own side of the answer', () => {
    const worked = [
      journal(1, [step('before', 1)], 0),
      journal(2, [step('after', 20)], 15),
    ];
    const notes = [said('station', 5), said('person', 10)];

    expect(
      workedOn(worked, notes, 'run_1', at(5)).map((each) => each.attempt),
    ).toEqual([1]);
    expect(
      workedOn(worked, notes, 'run_1').map((each) => each.attempt),
    ).toEqual([2]);
  });

  it('counts an attempt resumed after the answer that has done nothing yet as after it', () => {
    const worked = [journal(1, [step('before', 1)], 0), journal(2, [], 15)];
    const notes = [said('station', 5), said('person', 10)];

    expect(
      workedOn(worked, notes, 'run_1', at(5)).map((each) => each.attempt),
    ).toEqual([1]);
    expect(
      workedOn(worked, notes, 'run_1').map((each) => each.attempt),
    ).toEqual([2]);
  });

  it('does not split on what a person said before the run said anything', () => {
    const worked = [journal(1, [step('before', 1), step('after', 20)])];
    const notes = [said('person', 10), said('station', 25)];

    expect(texts(workedOn(worked, notes, 'run_1', at(25)))).toEqual([
      'before',
      'after',
    ]);
  });
});
