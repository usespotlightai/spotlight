import { describe, expect, it } from 'vitest';

import type {
  InboxChat,
  InboxEntry,
  InboxItem,
  InboxNotice,
  InboxPart,
  JournalStep,
  Note,
  RunJournal,
} from '@/lib/inbox';
import {
  chatPreviewOf,
  counted,
  entryKey,
  formatShortDuration,
  inboxItemPath,
  lastNoteAt,
  noticeLinkPath,
  noticePath,
  noticePreviewOf,
  previewOf,
  reopenable,
  resolvable,
  shownAt,
  spentIn,
  spentOn,
  workingWordsOf,
  threadText,
  unreadCountOf,
  workedOn,
} from '@/lib/inbox';
import { partial } from '@/test/partial';

const note = (position: number, runId: string | null) =>
  partial<Note>({ position, runId });

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

  it('opens on nothing in particular for a run without a note here', () => {
    expect(shownAt(notes, 'run_9')).toBeNull();
  });
});

describe('spentOn', () => {
  it('keeps enough of a small cost to still be a number', () => {
    expect(spentOn(0.0042)).toBe('$0.0042');
    expect(spentOn(0)).toBe('$0.00');
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
  const item = (
    lastNote: Partial<Note> | null,
    over: Partial<InboxItem> = {},
  ) =>
    partial<InboxItem>({
      station: 'Planning',
      description: 'A few quick steps will get everything ready.',
      lastNote: lastNote === null ? null : partial<Note>(lastNote),
      conversationId: null,
      latest: null,
      parts: [],
      ...over,
    });

  const part = (over: Partial<InboxPart>): InboxPart => ({
    id: 'request_1',
    kind: 'judge-question',
    form: 'judge-disagreement',
    about: 'disagreement_1',
    at: '2026-11-27T09:00:00.000Z',
    open: true,
    unread: false,
    resolvable: false,
    reopenable: false,
    ...over,
  });

  it('shows the last note', () => {
    expect(previewOf(item({ form: 'words', body: 'Which queue?' }))).toBe(
      'Which queue?',
    );
  });

  it('shows the task’s description, not the listed steps, for setting up a team', () => {
    expect(
      previewOf(item({ form: 'setup', body: '1. [Connect GitHub](/x). …' })),
    ).toBe('A few quick steps will get everything ready.');
  });

  it('says where it waits when there is no note', () => {
    expect(previewOf(item(null))).toBe('Waiting at Planning');
  });

  it('says a station asks, when its question is the newest unread thing', () => {
    expect(
      previewOf(
        item(
          { form: 'words', body: 'Which queue?' },
          { latest: { kind: 'question', count: 1 } },
        ),
      ),
    ).toBe('Planning asks: Which queue?');
  });

  it('says a run stopped, when a failed run waits for an answer', () => {
    expect(
      previewOf(
        item(
          { form: 'failure', body: 'The run exited.' },
          { latest: { kind: 'failure', count: 1 } },
        ),
      ),
    ).toBe('Planning stopped: The run exited.');
  });

  it('counts the judge questions that are new', () => {
    expect(
      previewOf(item(null, { latest: { kind: 'judge-question', count: 2 } })),
    ).toBe('2 judge questions');
  });

  it('says a station alert fired, and that it resolved', () => {
    const alert = (open: boolean) =>
      item(null, {
        parts: [part({ kind: 'alert', form: 'alert', about: 'alert_1', open })],
      });

    expect(previewOf(alert(true))).toBe('Station alert fired.');
    expect(previewOf(alert(false))).toBe('Station alert resolved.');
  });

  it('says the judge and people disagree on a run, and that someone answered', () => {
    const disagreement = (open: boolean) =>
      item(null, { parts: [part({ open })] });

    expect(previewOf(disagreement(true))).toBe(
      'The judge and people disagree on a run. Spotlight asks why.',
    );
    expect(previewOf(disagreement(false))).toBe('Disagreement resolved.');
  });
});

describe('unreadCountOf', () => {
  it('adds up what each entry counts as unread', () => {
    expect(
      unreadCountOf([
        partial<InboxItem>({ unreadCount: 4 }),
        partial<InboxChat>({ unreadCount: 1 }),
        partial<InboxNotice>({ unreadCount: 0 }),
      ]),
    ).toBe(5);
  });
});

describe('threadText', () => {
  const noteBy = (
    body: string,
    voice: Note['voice'],
    over: Partial<Note> = {},
  ) =>
    partial<Note>({
      body,
      voice,
      station: 'Implementation',
      author: null,
      ...over,
    });

  const journal = (...steps: Partial<JournalStep>[]) =>
    partial<RunJournal>({
      runId: 'run_1',
      steps: steps.map((step) => partial<JournalStep>(step)),
    });

  it('copies the briefing and every note, in order, naming the author of each', () => {
    expect(
      threadText({
        briefing: 'Drain the queue.',
        notes: [
          noteBy('Which queue?', 'station'),
          noteBy('The webhook one.', 'person', {
            author: { id: 'user_2', name: 'Maya Chen', image: null },
          }),
          noteBy('  ', 'station'),
          noteBy('Set up the team.', 'world'),
        ],
        ran: [journal({ kind: 'message', text: 'Not copied twice.' })],
        agent: 'Implementation',
      }),
    ).toBe(
      [
        'Briefing:\nDrain the queue.',
        'Implementation:\nWhich queue?',
        'Maya Chen:\nThe webhook one.',
        'Another tool:\nSet up the team.',
      ].join('\n\n'),
    );
  });

  it('takes the messages of the agent from its journal where there is no note', () => {
    expect(
      threadText({
        briefing: null,
        notes: [],
        ran: [
          journal(
            { kind: 'thought', text: 'Not a message.' },
            { kind: 'message', text: 'Done.' },
          ),
        ],
        agent: 'Implementation',
      }),
    ).toBe('Implementation:\nDone.');
  });

  it('copies nothing where there is no note and no message', () => {
    expect(
      threadText({
        briefing: '  ',
        notes: [],
        ran: [],
        agent: 'Implementation',
      }),
    ).toBe('');
  });
});

describe('lastNoteAt', () => {
  const noteAt = (body: string, at: string) => partial<Note>({ body, at });
  const journal = (...steps: Partial<JournalStep>[]) =>
    partial<RunJournal>({
      runId: 'run_1',
      steps: steps.map((step) => partial<JournalStep>(step)),
    });

  it('dates the last note in the conversation', () => {
    expect(
      lastNoteAt(
        [
          noteAt('First.', '2026-10-03T10:00:00Z'),
          noteAt('Last.', '2026-10-03T11:00:00Z'),
          noteAt(' ', '2026-10-03T12:00:00Z'),
        ],
        [],
      ),
    ).toBe('2026-10-03T11:00:00Z');
  });

  it('falls back on the last message of the agent in its journal, then on nothing', () => {
    expect(
      lastNoteAt(
        [],
        [
          journal(
            {
              kind: 'message',
              text: 'Done.',
              startedAt: '2026-10-03T09:00:00Z',
            },
            {
              kind: 'thought',
              text: 'Not a message.',
              startedAt: '2026-10-03T09:30:00Z',
            },
          ),
        ],
      ),
    ).toBe('2026-10-03T09:00:00Z');
    expect(lastNoteAt([], [])).toBeNull();
  });
});

describe('workedOn', () => {
  const at = (minute: number) =>
    new Date(Date.UTC(2026, 8, 29, 9, minute)).toISOString();

  const step = (text: string, minute: number) =>
    partial<JournalStep>({ text, startedAt: at(minute), ms: 30_000 });

  const journal = (
    attempt: number,
    steps: JournalStep[],
    began: number | null = null,
  ) =>
    partial<RunJournal>({
      runId: 'run_1',
      attempt,
      steps,
      ms: 600_000,
      marks: partial<RunJournal['marks']>({
        startedAt: began === null ? null : at(began),
      }),
    });

  const noteOf = (
    voice: Note['voice'],
    minute: number,
    runId: string | null = voice === 'person' ? null : 'run_1',
  ) => partial<Note>({ voice, runId, at: at(minute) });

  const texts = (journals: RunJournal[]) =>
    journals.flatMap((each) => each.steps.map((one) => one.text));

  it('hands a run that asked nobody everything it did', () => {
    const worked = [journal(1, [step('read', 1), step('edit', 2)])];

    expect(workedOn(worked, [noteOf('station', 5)], 'run_1')).toEqual(worked);
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
    const notes = [noteOf('station', 5), noteOf('person', 10)];

    expect(texts(workedOn(worked, notes, 'run_1', at(5)))).toEqual(['before']);
  });

  it('gives what it goes on to do only what came after the answer', () => {
    const worked = [journal(1, [step('before', 1), step('after', 20)])];
    const notes = [noteOf('station', 5), noteOf('person', 10)];

    expect(texts(workedOn(worked, notes, 'run_1'))).toEqual(['after']);
    expect(texts(workedOn(worked, notes, 'run_1', at(25)))).toEqual(['after']);
  });

  it('splits at an answer that came from Slack as it does at one typed here', () => {
    const worked = [journal(1, [step('before', 1), step('after', 20)])];
    const notes = [
      noteOf('station', 5),
      partial<Note>({
        voice: 'world',
        kind: 'answered',
        runId: null,
        at: at(10),
      }),
    ];

    expect(texts(workedOn(worked, notes, 'run_1', at(5)))).toEqual(['before']);
    expect(texts(workedOn(worked, notes, 'run_1'))).toEqual(['after']);
  });

  it('times a split attempt by the steps it kept', () => {
    const worked = [journal(1, [step('before', 1), step('after', 20)])];
    const notes = [noteOf('station', 5), noteOf('person', 10)];

    expect(workedOn(worked, notes, 'run_1')[0]?.ms).toBe(30_000);
  });

  it('keeps each attempt of a suspended run on its own side of the answer', () => {
    const worked = [
      journal(1, [step('before', 1)], 0),
      journal(2, [step('after', 20)], 15),
    ];
    const notes = [noteOf('station', 5), noteOf('person', 10)];

    expect(
      workedOn(worked, notes, 'run_1', at(5)).map((each) => each.attempt),
    ).toEqual([1]);
    expect(
      workedOn(worked, notes, 'run_1').map((each) => each.attempt),
    ).toEqual([2]);
  });

  it('counts an attempt resumed after the answer that has done nothing yet as after it', () => {
    const worked = [journal(1, [step('before', 1)], 0), journal(2, [], 15)];
    const notes = [noteOf('station', 5), noteOf('person', 10)];

    expect(
      workedOn(worked, notes, 'run_1', at(5)).map((each) => each.attempt),
    ).toEqual([1]);
    expect(
      workedOn(worked, notes, 'run_1').map((each) => each.attempt),
    ).toEqual([2]);
  });

  it('does not split on a message of a person before the first note of the run', () => {
    const worked = [journal(1, [step('before', 1), step('after', 20)])];
    const notes = [noteOf('person', 10), noteOf('station', 25)];

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
  headline: 'Spotlight opened a config pull request for the Build station',
  points: ['Candidate terse changes prompt.', 'Held-out gain: +8 points'],
  unreadCount: 0,
  link: 'lines/line_1/stations/station_1',
  linkLabel: 'Open the station',
  externalLink: {
    url: 'https://github.com/acme/config/pull/7',
    label: 'Review the pull request',
  },
  askedAt: '2026-10-01T10:00:00.000Z',
  unread: true,
  resolved: false,
  section: 'open',
  resolvable: true,
  reopenable: false,
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
      '/w/acme/team/team_1/lines/line_1/stations/station_1',
    );
  });

  it('previews its first point', () => {
    expect(noticePreviewOf(notice())).toBe('Candidate terse changes prompt.');
  });

  it('tells a notice from a conversation sharing its id', () => {
    const entries: InboxEntry[] = [
      notice({ id: 'same' }),
      partial<InboxItem>({ kind: 'task', id: 'same' }),
    ];

    expect(new Set(entries.map(entryKey)).size).toBe(2);
  });
});

describe('workingWordsOf', () => {
  it('says what the agent does while the run is in progress', () => {
    const command = {
      id: 'b1',
      kind: 'command',
      description: 'npx vitest run',
    } as const;

    expect(workingWordsOf('in-progress', 'Build')).toBe('Build is working…');
    expect(
      workingWordsOf('in-progress', 'Build', {
        activity: 'needs-action',
        background: [],
      }),
    ).toBe('Build needs a permission…');
    expect(
      workingWordsOf('in-progress', 'Build', {
        activity: 'waiting-for-background',
        background: [command],
      }),
    ).toBe('Build waits for background work…');
    expect(
      workingWordsOf('in-progress', 'Build', {
        activity: 'working',
        background: [command],
      }),
    ).toBe('Build is working…');
  });
});

describe('formatShortDuration', () => {
  it('shows seconds, minutes and hours at the scale they read best', () => {
    expect(formatShortDuration(400)).toBe('400ms');
    expect(formatShortDuration(42_000)).toBe('42s');
    expect(formatShortDuration(59_600)).toBe('1m');
    expect(formatShortDuration(239_600)).toBe('4m');
    expect(formatShortDuration(1_130_000)).toBe('18m 50s');
    expect(formatShortDuration(4_320_000)).toBe('1h 12m');
    expect(formatShortDuration(7_200_000)).toBe('2h');
    expect(formatShortDuration(167_040_000)).toBe('46h 24m');
  });
});

describe('chatPreviewOf', () => {
  const chat = (over: Partial<InboxChat> = {}): InboxChat => ({
    kind: 'chat',
    id: 'chat_1',
    teamId: 'team_1',
    title: 'Why do retries pile up?',
    progress: null,
    openProposals: 0,
    unreadCount: 0,
    askedAt: '2026-10-01T10:00:00.000Z',
    unread: false,
    resolved: false,
    section: 'open',
    reopenable: false,
    ...over,
  });

  it('says how far the run of a chat has come', () => {
    expect(chatPreviewOf(chat({ progress: 'queued' }))).toBe(
      'Queued. Agent starts when a runner is free.',
    );
  });

  it('counts the proposals that wait', () => {
    expect(chatPreviewOf(chat({ openProposals: 1 }))).toBe(
      '1 task proposal waiting for you.',
    );
    expect(chatPreviewOf(chat({ openProposals: 3 }))).toBe(
      '3 task proposals waiting for you.',
    );
  });

  it('says a chat is resolved, or waits for its starter', () => {
    expect(chatPreviewOf(chat({ resolved: true }))).toBe('Chat resolved.');
    expect(chatPreviewOf(chat())).toBe('Waiting for you.');
  });

  it('lets a person resolve a chat until it is resolved, then reopen it', () => {
    expect(resolvable(chat())).toBe(true);
    expect(resolvable(chat({ resolved: true }))).toBe(false);
    expect(reopenable(chat({ resolved: true, reopenable: true }))).toBe(true);
  });
});

describe('resolvable', () => {
  const conversation = (over: Partial<InboxItem>) =>
    partial<InboxItem>({
      kind: 'task',
      id: 'task_1:3',
      resolved: false,
      standing: 'assignee',
      resolvable: true,
      ...over,
    });

  it('follows the server for a conversation', () => {
    expect(resolvable(conversation({}))).toBe(true);
    expect(resolvable(conversation({ resolvable: false }))).toBe(false);
    expect(
      resolvable(conversation({ standing: 'asked', resolvable: false })),
    ).toBe(false);
  });

  it('follows the server for a notice', () => {
    expect(resolvable(notice())).toBe(true);
    expect(resolvable(notice({ resolvable: false }))).toBe(false);
  });
});
