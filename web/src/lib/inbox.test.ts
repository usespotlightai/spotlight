import { describe, expect, it } from 'vitest';
import type {
  InboxEntry,
  InboxItem,
  InboxMessage,
  InboxNotice,
  JournalStep,
  RunJournal,
} from '@/lib/inbox';
import {
  counted,
  decisionPending,
  inboxItemPath,
  lastSpokenAt,
  noticeLinkPath,
  noticeOf,
  noticePath,
  noticePreviewOf,
  previewOf,
  shownAt,
  spentIn,
  spentOn,
  taskItemOf,
  threadText,
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

describe('counted', () => {
  it('shortens tokens to thousands and millions', () => {
    expect(counted(950)).toBe('950');
    expect(counted(412_300)).toBe('412.3k');
    expect(counted(2_480_000)).toBe('2.5M');
    expect(counted(999_960)).toBe('1M');
  });
});

describe('spentIn', () => {
  it('writes dollars as the rest of the app does, and names any other currency', () => {
    expect(spentIn(0.25, 'USD')).toBe('$0.25');
    expect(spentIn(3, 'EUR')).toBe('3.00 EUR');
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

  it('says a station crossed its alert, and that it came back within it', () => {
    const alert = (resolved: boolean) =>
      ({
        ...item([]),
        resolved,
        aside: { form: 'alert', about: 'alert_1' },
      }) as InboxItem;

    expect(previewOf(alert(false))).toBe('Station crossed an alert threshold.');
    expect(previewOf(alert(true))).toBe(
      'Station back within its alert threshold.',
    );
  });
});

describe('decisionPending', () => {
  const asked = (form: InboxMessage['form']) =>
    ({ kind: 'asked', form }) as InboxMessage;

  it('has a pending decision where the last question put up an approval', () => {
    expect(decisionPending([asked('words'), asked('approval')])).toBe(true);
  });

  it('has only a pending answer where the last question was put in words', () => {
    expect(decisionPending([asked('approval'), asked('words')])).toBe(false);
    expect(decisionPending([])).toBe(false);
  });
});

describe('threadText', () => {
  const spoke = (
    body: string,
    voice: InboxMessage['voice'],
    over: Partial<InboxMessage> = {},
  ) =>
    ({
      body,
      voice,
      station: 'Implementation',
      author: null,
      ...over,
    }) as InboxMessage;

  const journal = (...steps: { kind: string; text: string }[]) =>
    ({ runId: 'run_1', steps }) as unknown as RunJournal;

  it('copies the briefing and everything said, in order, naming who said it', () => {
    expect(
      threadText({
        opening: 'Drain the queue.',
        notes: [
          spoke('Which queue?', 'station'),
          spoke('The webhook one.', 'person', {
            author: { id: 'user_2', name: 'Maya Chen', image: null },
          }),
          spoke('  ', 'station'),
          spoke('Set up the team.', 'world'),
        ],
        ran: [journal({ kind: 'said', text: 'Not copied twice.' })],
        agent: 'Implementation',
      }),
    ).toBe(
      [
        'Briefing:\nDrain the queue.',
        'Implementation:\nWhich queue?',
        'Maya Chen:\nThe webhook one.',
        'Spotlight:\nSet up the team.',
      ].join('\n\n'),
    );
  });

  it('takes what the agent said from its journal where nobody spoke', () => {
    expect(
      threadText({
        opening: null,
        notes: [],
        ran: [
          journal(
            { kind: 'thought', text: 'Not said.' },
            { kind: 'said', text: 'Done.' },
          ),
        ],
        agent: 'Implementation',
      }),
    ).toBe('Implementation:\nDone.');
  });

  it('copies nothing where nothing was said', () => {
    expect(
      threadText({
        opening: '  ',
        notes: [],
        ran: [],
        agent: 'Implementation',
      }),
    ).toBe('');
  });
});

describe('lastSpokenAt', () => {
  const spoke = (body: string, at: string) => ({ body, at }) as InboxMessage;
  const journal = (
    ...steps: { kind: string; text: string; startedAt: string }[]
  ) => ({ runId: 'run_1', steps }) as unknown as RunJournal;

  it('dates the last thing said in the conversation', () => {
    expect(
      lastSpokenAt(
        [
          spoke('First.', '2026-10-03T10:00:00Z'),
          spoke('Last.', '2026-10-03T11:00:00Z'),
          spoke(' ', '2026-10-03T12:00:00Z'),
        ],
        [],
      ),
    ).toBe('2026-10-03T11:00:00Z');
  });

  it('falls back on what the agent said in its journal, then on nothing', () => {
    expect(
      lastSpokenAt(
        [],
        [
          journal(
            { kind: 'said', text: 'Done.', startedAt: '2026-10-03T09:00:00Z' },
            {
              kind: 'thought',
              text: 'Not said.',
              startedAt: '2026-10-03T09:30:00Z',
            },
          ),
        ],
      ),
    ).toBe('2026-10-03T09:00:00Z');
    expect(lastSpokenAt([], [])).toBeNull();
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

  it('keeps each attempt of a suspended run on its own side of the answer', () => {
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

const notice = (over: Partial<InboxNotice> = {}): InboxNotice => ({
  kind: 'notice',
  id: 'notice_1',
  teamId: 'team_1',
  form: 'ended',
  headline: 'The search stalled',
  points: ['Fix the judge’s rubric (Rename the worker): it wants tests.'],
  link: 'lines/line_1/stations/station_1/searches/search_1',
  linkLabel: 'Open the search',
  askedAt: '2026-10-01T10:00:00.000Z',
  unread: true,
  resolved: false,
  ...over,
});

describe('notices', () => {
  it('addresses a notice in the inbox apart from conversations', () => {
    expect(noticePath('acme', 'notice 1')).toBe(
      '/w/acme/inbox/notices/notice%201',
    );
  });

  it('turns the link within its team into a full route', () => {
    expect(noticeLinkPath('acme', notice())).toBe(
      '/w/acme/team/team_1/lines/line_1/stations/station_1/searches/search_1',
    );
  });

  it('previews its first point', () => {
    expect(noticePreviewOf(notice())).toBe(
      'Fix the judge’s rubric (Rename the worker): it wants tests.',
    );
  });

  it('tells a notice from a conversation sharing its id', () => {
    const entries: InboxEntry[] = [
      notice({ id: 'same' }),
      { kind: 'task', id: 'same' } as InboxItem,
    ];

    expect(noticeOf(entries, 'same')?.kind).toBe('notice');
    expect(taskItemOf(entries, 'same')?.kind).toBe('task');
    expect(noticeOf(entries, 'other')).toBeUndefined();
  });
});
