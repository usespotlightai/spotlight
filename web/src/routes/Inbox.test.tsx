import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { Inbox } from '@/routes/Inbox';

const waiting = vi.fn<(...args: unknown[]) => unknown>();
const failing = vi.fn();
const refetch = vi.fn();
const resolve = vi.fn();
const reopen = vi.fn();
const resolvedOnes = vi.fn<(...args: unknown[]) => unknown>();
const moreResolved = vi.fn<(...args: unknown[]) => unknown>();
const resolvedPending = vi.fn<(...args: unknown[]) => unknown>();

vi.mock('@/hooks/api/useInbox', () => ({
  inboxKeys: { forWorkspace: () => ['inbox'] },
  useInbox: () => ({
    data: waiting(),
    isPending: waiting() === undefined,
    errorUpdateCount: failing() ? 1 : 0,
    isFetching: false,
    refetch,
  }),
  useResolvedInbox: () => ({
    data: resolvedOnes(),
    isPending: resolvedPending(),
    errorUpdateCount: 0,
    isFetching: false,
    refetch,
    more: { available: moreResolved(), loading: false, load: vi.fn() },
  }),
}));

vi.mock('@/hooks/api/useResolveInboxEntry', () => ({
  useResolveInboxEntry: () => ({ mutate: resolve, isPending: false }),
}));

vi.mock('@/hooks/api/useReopenInboxEntry', () => ({
  useReopenInboxEntry: () => ({ mutate: reopen, isPending: false }),
}));

const item = (over: Record<string, unknown> = {}) => ({
  kind: 'task',
  id: 'task_1:0',
  taskId: 'task_1',
  teamId: 'team_1',
  title: 'Fix the queue',
  description: null,
  station: 'Implementation',
  stationColor: '#5c66d9',
  stationPosition: 2,
  stationCount: 4,
  originStation: {
    station: 'Triage',
    stationColor: '#edc12b',
    stationPosition: 0,
  },
  createdAt: '2026-08-29T09:02:00.000Z',
  askedAt: '2026-08-29T12:00:00.000Z',
  resolved: false,
  section: 'open',
  reopenable: false,
  progress: null,
  runId: null,
  inboxRequest: null,
  unread: false,
  lastNote: {
    position: 0,
    kind: 'asked',
    station: 'Implementation',
    stationColor: '#5c66d9',
    stationPosition: 2,
    runId: null,
    body: 'Which queue should I drain?',
    at: '2026-08-29T12:00:00.000Z',
    author: null,
  },
  ...over,
});

const notice = (over: Record<string, unknown> = {}) => ({
  kind: 'notice',
  id: 'notice_1',
  teamId: 'team_1',
  form: 'ended',
  headline: 'The search for a better Build config stalled',
  points: ['Fix the judge’s rubric: it requires tests a rename never needs.'],
  link: 'lines/line_1/stations/station_1',
  linkLabel: 'Open the station',
  externalLink: null,
  askedAt: '2026-08-29T13:00:00.000Z',
  unread: true,
  resolved: false,
  section: 'open',
  reopenable: false,
  ...over,
});

const chat = (over: Record<string, unknown> = {}) => ({
  kind: 'chat',
  id: 'chat_1',
  teamId: 'team_1',
  title: 'Why do retries pile up?',
  progress: null,
  openProposals: 0,
  askedAt: '2026-08-29T14:00:00.000Z',
  unread: false,
  resolved: false,
  section: 'open',
  reopenable: false,
  ...over,
});

const markChatRead = vi.fn();

vi.mock('@/hooks/api/useMarkInboxChatRead', () => ({
  useMarkInboxChatRead: () => ({ mutate: markChatRead }),
}));

const tree = (path: string) => (
  <MemoryRouter initialEntries={[path]}>
    <Routes>
      <Route path="/w/:slug/inbox" element={<Inbox />}>
        <Route path=":itemId" element={<p>the conversation</p>} />
        <Route path="teams/:teamId/chats/:chatId" element={<p>the chat</p>} />
      </Route>
    </Routes>
  </MemoryRouter>
);

const renderAt = (path: string) => render(tree(path));

describe('Inbox', () => {
  beforeEach(() => {
    localStorage.clear();
    waiting.mockReturnValue([item()]);
    failing.mockReturnValue(false);
    resolvedOnes.mockReturnValue([]);
    moreResolved.mockReturnValue(false);
    resolvedPending.mockReturnValue(false);
    refetch.mockClear();
    resolve.mockClear();
    reopen.mockClear();
  });

  describe('chats', () => {
    it('lists a chat that waits for its starter under Open, linking to it in the inbox', () => {
      waiting.mockReturnValue([chat({ openProposals: 2, unread: true })]);
      renderAt('/w/acme/inbox');

      expect(
        screen.getByRole('link', { name: /Why do retries pile up\?/ }),
      ).toHaveAttribute('href', '/w/acme/inbox/teams/team_1/chats/chat_1');
      expect(
        screen.getByText('2 task proposals waiting for you.'),
      ).toBeVisible();
      expect(screen.getByText('Unread')).toBeInTheDocument();
    });

    it('lists a chat with a run under Running, saying how far it is', async () => {
      waiting.mockReturnValue([
        chat({ progress: 'in-progress', section: 'running' }),
      ]);
      renderAt('/w/acme/inbox');

      await userEvent.click(screen.getByRole('button', { name: /Running/ }));

      expect(screen.getByText('Agent is working…')).toBeVisible();
    });

    it('lists a resolved chat under Resolved', async () => {
      waiting.mockReturnValue([
        chat({ resolved: true, section: 'resolved', reopenable: true }),
      ]);
      renderAt('/w/acme/inbox');

      await userEvent.click(screen.getByRole('button', { name: /Resolved/ }));

      expect(screen.getByText('Chat resolved.')).toBeVisible();
    });

    it('marks a chat read when it is opened', async () => {
      waiting.mockReturnValue([chat({ unread: true })]);
      renderAt('/w/acme/inbox');

      await userEvent.click(
        screen.getByRole('link', { name: /Why do retries pile up\?/ }),
      );

      expect(markChatRead).toHaveBeenCalledWith({
        slug: 'acme',
        chatId: 'chat_1',
      });
    });

    it('opens a chat beside the list', async () => {
      waiting.mockReturnValue([chat()]);
      renderAt('/w/acme/inbox');

      const row = screen.getByRole('link', {
        name: /Why do retries pile up\?/,
      });
      await userEvent.click(row);

      expect(screen.getByText('the chat')).toBeVisible();
      expect(row).toHaveAttribute('aria-current', 'page');
    });

    it('resolves and unresolves a chat by hand', async () => {
      waiting.mockReturnValue([chat()]);
      renderAt('/w/acme/inbox');

      await userEvent.click(screen.getByRole('button', { name: 'Resolve' }));

      expect(resolve).toHaveBeenCalledWith({
        slug: 'acme',
        entry: expect.objectContaining({
          kind: 'chat',
          id: 'chat_1',
        }) as unknown,
      });
    });
  });

  describe('resolving', () => {
    it('resolves what is open on request', async () => {
      renderAt('/w/acme/inbox');

      await userEvent.click(screen.getByRole('button', { name: 'Resolve' }));

      expect(resolve).toHaveBeenCalledWith({
        slug: 'acme',
        entry: expect.objectContaining({ id: 'task_1:0' }) as unknown,
      });
    });

    it('unresolves what is resolved on request', async () => {
      waiting.mockReturnValue([
        notice({
          resolved: true,
          unread: false,
          section: 'resolved',
          reopenable: true,
        }),
      ]);
      renderAt('/w/acme/inbox');

      await userEvent.click(screen.getByRole('button', { name: /Resolved/ }));
      await userEvent.click(screen.getByRole('button', { name: 'Unresolve' }));

      expect(reopen).toHaveBeenCalledWith({
        slug: 'acme',
        entry: expect.objectContaining({ id: 'notice_1' }) as unknown,
      });
    });

    it('does not offer to unresolve a conversation that moved on by itself', () => {
      waiting.mockReturnValue([item({ resolved: true, section: 'resolved' })]);
      renderAt('/w/acme/inbox');

      expect(
        screen.queryByRole('button', { name: 'Unresolve' }),
      ).not.toBeInTheDocument();
    });
  });

  it('leaves the list blank when the inbox could not be loaded, even while it tries again', () => {
    waiting.mockReturnValue(undefined);
    failing.mockReturnValue(true);
    renderAt('/w/acme/inbox');

    expect(screen.getByRole('heading')).toHaveTextContent('Inbox');
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
    expect(
      screen.queryByRole('status', { name: 'Loading the inbox' }),
    ).not.toBeInTheDocument();
  });

  it('keeps every section, empty, when nothing is waiting', () => {
    waiting.mockReturnValue([]);
    renderAt('/w/acme/inbox');

    expect(screen.getByRole('heading')).toHaveTextContent('Inbox');
    expect(screen.getByRole('button', { name: /Open/ })).toHaveTextContent('0');
    expect(screen.getByRole('button', { name: /Running/ })).toHaveTextContent(
      '0',
    );
    expect(screen.getByRole('button', { name: /Resolved/ })).toHaveTextContent(
      '0',
    );
    expect(
      screen.queryByRole('status', { name: 'Loading the inbox' }),
    ).not.toBeInTheDocument();
  });

  it('names the list, leaving the trail to the message beside it', () => {
    renderAt('/w/acme/inbox/task_1%3A0');

    expect(screen.getByRole('heading')).toHaveTextContent('Inbox');
    expect(screen.getByRole('heading')).not.toHaveTextContent('Platform');
  });

  it('keeps the shape of the list while it loads, beside the conversation', () => {
    waiting.mockReturnValue(undefined);
    renderAt('/w/acme/inbox/task_1%3A0');

    expect(
      screen.getByRole('status', { name: 'Loading the inbox' }),
    ).toBeInTheDocument();
    expect(screen.getByRole('heading')).toHaveTextContent('Inbox');
    expect(screen.getByText('the conversation')).toBeInTheDocument();
    expect(
      screen.queryByText('Nothing is waiting on you.'),
    ).not.toBeInTheDocument();
  });

  describe('what is still open', () => {
    it('counts what is in it', () => {
      renderAt('/w/acme/inbox');

      const section = screen.getByRole('button', { name: /Open/ });

      expect(section).toHaveTextContent('Open');
      expect(section).toHaveTextContent('1');
    });

    it('collapses on request, and leaves resolved alone', async () => {
      const person = userEvent.setup();
      waiting.mockReturnValue([
        item(),
        item({
          id: 'task_2:0',
          taskId: 'task_2',
          resolved: true,
          section: 'resolved',
        }),
      ]);
      renderAt('/w/acme/inbox');

      await person.click(screen.getByRole('button', { name: /Open/ }));

      expect(screen.getByRole('button', { name: /Open/ })).toHaveAttribute(
        'aria-expanded',
        'false',
      );
      expect(screen.getByRole('button', { name: /Resolved/ })).toHaveAttribute(
        'aria-expanded',
        'false',
      );
    });

    it('counts a failure that keeps happening', () => {
      waiting.mockReturnValue([
        item({ failure: { source: 'run', code: 'exited', occurrences: 3 } }),
      ]);
      renderAt('/w/acme/inbox');

      expect(screen.getByText('Failed 3 times')).toBeInTheDocument();
    });

    it('does not count a failure that happened once', () => {
      waiting.mockReturnValue([
        item({ failure: { source: 'run', code: 'exited', occurrences: 1 } }),
      ]);
      renderAt('/w/acme/inbox');

      expect(screen.queryByText(/Failed/)).not.toBeInTheDocument();
    });

    it('stays, counting none, when nothing is open', () => {
      waiting.mockReturnValue([item({ resolved: true, section: 'resolved' })]);
      renderAt('/w/acme/inbox');

      expect(screen.getByRole('button', { name: /Open/ })).toHaveTextContent(
        '0',
      );
    });
  });

  describe('what is running', () => {
    beforeEach(() => {
      waiting.mockReturnValue([
        item(),
        item({
          id: 'task_2:0',
          taskId: 'task_2',
          title: 'Cap the retries',
          progress: 'in-progress',
          runId: 'run_2',
          section: 'running',
        }),
      ]);
    });

    it('holds what an agent works on, apart from what is open', () => {
      renderAt('/w/acme/inbox');

      expect(screen.getByRole('button', { name: /Running/ })).toHaveTextContent(
        '1',
      );
      expect(screen.getByRole('button', { name: /Open/ })).toHaveTextContent(
        '1',
      );
    });

    it('is collapsed to begin with', () => {
      renderAt('/w/acme/inbox');

      expect(screen.getByRole('button', { name: /Running/ })).toHaveAttribute(
        'aria-expanded',
        'false',
      );
    });

    it('opens on request', async () => {
      const person = userEvent.setup();
      renderAt('/w/acme/inbox');

      await person.click(screen.getByRole('button', { name: /Running/ }));

      expect(screen.getByRole('button', { name: /Running/ })).toHaveAttribute(
        'aria-expanded',
        'true',
      );
      expect(
        screen.getByRole('link', { name: /Cap the retries/ }),
      ).toBeInTheDocument();
    });

    it('moves to open once it waits on a person', () => {
      const { rerender } = renderAt('/w/acme/inbox');

      waiting.mockReturnValue([
        item(),
        item({ id: 'task_2:0', taskId: 'task_2', title: 'Cap the retries' }),
      ]);
      rerender(tree('/w/acme/inbox'));

      expect(screen.getByRole('button', { name: /Running/ })).toHaveTextContent(
        '0',
      );
      expect(screen.getByRole('button', { name: /Open/ })).toHaveTextContent(
        '2',
      );
    });

    it('holds a run on your task that has nothing to ask, and opens it here', async () => {
      const person = userEvent.setup();
      waiting.mockReturnValue([
        {
          kind: 'run',
          id: 'run_9',
          taskId: 'task_9',
          teamId: 'team_1',
          title: 'Drain the retry queue',
          station: 'Implementation',
          stationColor: '#5c66d9',
          stationPosition: 2,
          stationCount: 4,
          progress: 'in-progress',
          askedAt: '2026-08-29T12:00:00.000Z',
          unread: false,
          resolved: false,
          section: 'running',
          reopenable: false,
        },
      ]);
      renderAt('/w/acme/inbox');

      await person.click(screen.getByRole('button', { name: /Running/ }));

      const link = screen.getByRole('link', { name: /Drain the retry queue/ });
      expect(link).toHaveAttribute(
        'href',
        '/w/acme/inbox/teams/team_1/runs/run_9',
      );
      expect(link).toHaveTextContent('Implementation is working…');
      expect(
        screen.queryByRole('button', { name: 'Resolve' }),
      ).not.toBeInTheDocument();
    });

    it('leaves what is resolved where it is', () => {
      waiting.mockReturnValue([
        item({
          resolved: true,
          progress: 'in-progress',
          section: 'resolved',
        }),
      ]);
      renderAt('/w/acme/inbox');

      expect(screen.getByRole('button', { name: /Running/ })).toHaveTextContent(
        '0',
      );
      expect(
        screen.getByRole('button', { name: /Resolved/ }),
      ).toHaveTextContent('1');
    });
  });

  describe('what has been resolved', () => {
    beforeEach(() => {
      waiting.mockReturnValue([
        item(),
        item({
          id: 'task_2:0',
          taskId: 'task_2',
          title: 'Cap the retries',
          resolved: true,
          section: 'resolved',
        }),
      ]);
    });

    it('counts what is in it', () => {
      renderAt('/w/acme/inbox');

      const section = screen.getByRole('button', { name: /Resolved/ });

      expect(section).toHaveTextContent('Resolved');
      expect(section).toHaveTextContent('1');
    });

    it('is collapsed to begin with', () => {
      renderAt('/w/acme/inbox');

      expect(screen.getByRole('button', { name: /Resolved/ })).toHaveAttribute(
        'aria-expanded',
        'false',
      );
    });

    it('opens on request', async () => {
      const person = userEvent.setup();
      renderAt('/w/acme/inbox');

      await person.click(screen.getByRole('button', { name: /Resolved/ }));

      expect(screen.getByRole('button', { name: /Resolved/ })).toHaveAttribute(
        'aria-expanded',
        'true',
      );
    });

    it('counts the first page of resolved entries while collapsed', () => {
      waiting.mockReturnValue([item()]);
      resolvedOnes.mockReturnValue([
        item({
          id: 'task_3:0',
          taskId: 'task_3',
          resolved: true,
          section: 'resolved',
        }),
        item({
          id: 'task_4:0',
          taskId: 'task_4',
          resolved: true,
          section: 'resolved',
        }),
      ]);
      moreResolved.mockReturnValue(true);
      renderAt('/w/acme/inbox');

      const section = screen.getByRole('button', { name: /Resolved/ });

      expect(section).toHaveAttribute('aria-expanded', 'false');
      expect(section).toHaveTextContent('2+');
    });

    it('shows a placeholder count until the resolved entries arrive', () => {
      waiting.mockReturnValue([item()]);
      resolvedOnes.mockReturnValue(undefined);
      resolvedPending.mockReturnValue(true);
      renderAt('/w/acme/inbox');

      const section = screen.getByRole('button', { name: /Resolved/ });

      expect(section.querySelector('span[aria-hidden]')).not.toBeNull();
      expect(section).toHaveTextContent(/^Resolved$/);
    });

    it('counts what it has, with no placeholder, when the resolved entries fail', () => {
      waiting.mockReturnValue([item()]);
      resolvedOnes.mockReturnValue(undefined);
      renderAt('/w/acme/inbox');

      const section = screen.getByRole('button', { name: /Resolved/ });

      expect(section.querySelector('span[aria-hidden]')).toBeNull();
      expect(section).toHaveTextContent('0');
    });

    it('stays, counting none, when nothing is resolved', () => {
      waiting.mockReturnValue([item()]);
      renderAt('/w/acme/inbox');

      expect(
        screen.getByRole('button', { name: /Resolved/ }),
      ).toHaveTextContent('0');
    });
  });

  describe('a notice about the team’s work', () => {
    it('sits among what is open, by its headline and first point, unread', () => {
      waiting.mockReturnValue([notice(), item()]);
      renderAt('/w/acme/inbox');

      expect(screen.getByRole('button', { name: /Open/ })).toHaveTextContent(
        '2',
      );

      const link = screen.getByRole('link', {
        name: /The search for a better Build config stalled/,
      });
      expect(link).toHaveAttribute('href', '/w/acme/inbox/notices/notice_1');
      expect(link).toHaveTextContent('Unread');
      expect(link).toHaveTextContent(
        'Fix the judge’s rubric: it requires tests a rename never needs.',
      );
      expect(
        link.querySelector('[data-slot="notice-icon"]'),
      ).toBeInTheDocument();
    });

    it('moves to resolved once dismissed', () => {
      waiting.mockReturnValue([
        notice({
          resolved: true,
          unread: false,
          section: 'resolved',
          reopenable: true,
        }),
        item(),
      ]);
      renderAt('/w/acme/inbox');

      expect(
        screen.getByRole('button', { name: /Resolved/ }),
      ).toHaveTextContent('1');
      expect(screen.getByRole('button', { name: /Open/ })).toHaveTextContent(
        '1',
      );
    });
  });
});
