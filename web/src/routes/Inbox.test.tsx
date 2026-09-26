import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { Inbox } from '@/routes/Inbox';

const waiting = vi.fn();
const failing = vi.fn();
const refetch = vi.fn();

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
  raisedAt: { station: 'Triage', stationColor: '#edc12b', stationPosition: 0 },
  createdAt: '2026-08-29T09:02:00.000Z',
  askedAt: '2026-08-29T12:00:00.000Z',
  resolved: false,
  working: false,
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
  });

  it('leaves the list blank when the inbox could not be loaded, even while it tries again', () => {
    waiting.mockReturnValue(undefined);
    failing.mockReturnValue(true);
    renderAt('/w/acme/inbox');

    expect(screen.getByRole('heading')).toHaveTextContent('Inbox');
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
    expect(screen.queryByRole('status')).not.toBeInTheDocument();
  });

  it('leaves the list blank when nothing is waiting', () => {
    waiting.mockReturnValue([]);
    renderAt('/w/acme/inbox');

    expect(screen.getByRole('heading')).toHaveTextContent('Inbox');
    expect(screen.queryByRole('button')).not.toBeInTheDocument();
    expect(screen.queryByRole('status')).not.toBeInTheDocument();
  });

  it('names the list, leaving the trail to the message beside it', () => {
    renderAt('/w/acme/inbox/task_1%3A0');

    expect(screen.getByRole('heading')).toHaveTextContent('Inbox');
    expect(screen.getByRole('heading')).not.toHaveTextContent('Platform');
  });

  it('holds the shape of the list while it loads, beside the conversation', () => {
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

    it('folds away when asked, leaving resolved alone', async () => {
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
        'true',
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

    it('says nothing about open when nothing is', () => {
      waiting.mockReturnValue([item({ resolved: true })]);
      renderAt('/w/acme/inbox');

      expect(
        screen.queryByRole('button', { name: /Open/ }),
      ).not.toBeInTheDocument();
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

    it('opens to begin with', () => {
      renderAt('/w/acme/inbox');

      expect(screen.getByRole('button', { name: /Resolved/ })).toHaveAttribute(
        'aria-expanded',
        'true',
      );
    });

    it('folds away when asked', async () => {
      const person = userEvent.setup();
      renderAt('/w/acme/inbox');

      await person.click(screen.getByRole('button', { name: /Resolved/ }));

      expect(screen.getByRole('button', { name: /Resolved/ })).toHaveAttribute(
        'aria-expanded',
        'false',
      );
    });

    it('says nothing about resolved when nothing is', () => {
      waiting.mockReturnValue([item()]);
      renderAt('/w/acme/inbox');

      expect(
        screen.queryByRole('button', { name: /Resolved/ }),
      ).not.toBeInTheDocument();
    });
  });
});
