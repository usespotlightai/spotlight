import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { Inbox } from '@/routes/Inbox';

const waiting = vi.fn();
const failing = vi.fn();
const refetch = vi.fn();
const resolve = vi.fn();
const reopen = vi.fn();

vi.mock('@/hooks/api/useInbox', () => ({
  inboxKeys: { forWorkspace: () => ['inbox'] },
  useInbox: () => ({
    data: waiting(),
    isPending: waiting() === undefined,
    errorUpdateCount: failing() ? 1 : 0,
    isFetching: false,
    refetch,
  }),
}));

vi.mock('@/hooks/api/useResolveInboxEntry', () => ({
  useResolveInboxEntry: () => ({ mutate: resolve, isPending: false }),
}));

vi.mock('@/hooks/api/useReopenInboxEntry', () => ({
  useReopenInboxEntry: () => ({ mutate: reopen, isPending: false }),
}));

const item = (over: Record<string, unknown> = {}) => ({
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
  progress: null,
  runId: null,
  inboxRequest: null,
  unread: false,
  notes: [
    {
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
  ],
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
  ...over,
});

const renderAt = (path: string) =>
  render(
    <MemoryRouter initialEntries={[path]}>
      <Routes>
        <Route path="/w/:slug/inbox" element={<Inbox />}>
          <Route path=":itemId" element={<p>the conversation</p>} />
        </Route>
      </Routes>
    </MemoryRouter>,
  );

describe('Inbox', () => {
  beforeEach(() => {
    localStorage.clear();
    waiting.mockReturnValue([item()]);
    failing.mockReturnValue(false);
    refetch.mockClear();
    resolve.mockClear();
    reopen.mockClear();
  });

  describe('resolving', () => {
    it('resolves what is open on request', async () => {
      renderAt('/w/acme/inbox');

      await userEvent.click(screen.getByRole('button', { name: 'Resolve' }));

      expect(resolve).toHaveBeenCalledWith({
        slug: 'acme',
        entry: expect.objectContaining({ id: 'task_1:0' }),
      });
    });

    it('unresolves what is resolved on request', async () => {
      waiting.mockReturnValue([notice({ resolved: true, unread: false })]);
      renderAt('/w/acme/inbox');

      await userEvent.click(screen.getByRole('button', { name: /Resolved/ }));
      await userEvent.click(screen.getByRole('button', { name: 'Unresolve' }));

      expect(reopen).toHaveBeenCalledWith({
        slug: 'acme',
        entry: expect.objectContaining({ id: 'notice_1' }),
      });
    });

    it('does not offer to unresolve a conversation that moved on by itself', () => {
      waiting.mockReturnValue([item({ resolved: true })]);
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

  it('keeps both sections, empty, when nothing is waiting', () => {
    waiting.mockReturnValue([]);
    renderAt('/w/acme/inbox');

    expect(screen.getByRole('heading')).toHaveTextContent('Inbox');
    expect(screen.getByRole('button', { name: /Open/ })).toHaveTextContent('0');
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
        item({ id: 'task_2:0', taskId: 'task_2', resolved: true }),
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
      waiting.mockReturnValue([item({ resolved: true })]);
      renderAt('/w/acme/inbox');

      expect(screen.getByRole('button', { name: /Open/ })).toHaveTextContent(
        '0',
      );
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
        notice({ resolved: true, unread: false }),
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
