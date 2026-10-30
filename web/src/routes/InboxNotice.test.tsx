import { render, screen, within } from '@testing-library/react';
import { act } from 'react';
import { MemoryRouter, Route, Routes } from 'react-router';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { GONE_FROM_INBOX } from '@/lib/inbox';
import { InboxNotice } from '@/routes/InboxNotice';

const waiting = vi.fn();
const failing = vi.fn();
const resolve = vi.fn();
const resolving = vi.fn();

vi.mock('@/hooks/api/useInbox', () => ({
  inboxKeys: { forWorkspace: () => ['inbox'] },
  useInbox: () => ({
    data: waiting(),
    isPending: waiting() === undefined,
    errorUpdateCount: failing() ? 1 : 0,
    isFetching: false,
    refetch: vi.fn(),
  }),
}));

vi.mock('@/hooks/api/useWorkspace', () => ({
  useWorkspace: () => ({
    data: { teams: [{ id: 'team_1', name: 'Platform' }] },
  }),
}));

vi.mock('@/hooks/api/useResolveInboxNotice', () => ({
  useResolveInboxNotice: () => ({
    mutate: resolve,
    isPending: false,
    isError: resolving() !== null,
    error: resolving() === 'gone' ? { status: 404 } : resolving() && {},
  }),
}));

const notice = (over: Record<string, unknown> = {}) => ({
  kind: 'notice',
  id: 'notice_1',
  teamId: 'team_1',
  form: 'ended',
  headline: 'The search for a better Build config stalled',
  points: [
    'Fix the judge’s rubric: it requires tests a rename never needs.',
    'Fix the station’s check: it needs a database the runner never starts.',
  ],
  link: 'lines/line_1/stations/station_1',
  linkLabel: 'Open the station',
  externalLink: null,
  askedAt: '2026-08-29T13:00:00.000Z',
  unread: true,
  resolved: false,
  ...over,
});

const noticeAt = (noticeId = 'notice_1') => (
  <MemoryRouter initialEntries={[`/w/acme/inbox/notices/${noticeId}`]}>
    <Routes>
      <Route
        path="/w/:slug/inbox/notices/:noticeId"
        element={<InboxNotice />}
      />
    </Routes>
  </MemoryRouter>
);

const renderNotice = (noticeId = 'notice_1') => render(noticeAt(noticeId));

describe('InboxNotice', () => {
  beforeEach(() => {
    waiting.mockReturnValue([notice()]);
    failing.mockReturnValue(false);
    resolving.mockReturnValue(null);
    resolve.mockClear();
  });

  it('keeps the notice’s place while the inbox loads', () => {
    waiting.mockReturnValue(undefined);
    renderNotice();

    expect(screen.getByRole('status')).toHaveAttribute(
      'data-slot',
      'notice-skeleton',
    );
  });

  it('says the inbox could not be loaded', () => {
    waiting.mockReturnValue(undefined);
    failing.mockReturnValue(true);
    renderNotice();

    expect(screen.getByText(/The inbox/)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Try again/ })).toBeVisible();
  });

  it('says nothing is waiting where the notice is gone', () => {
    renderNotice('notice_gone');

    expect(screen.getByText(GONE_FROM_INBOX)).toBeInTheDocument();
  });

  it('says nothing is waiting where opening it finds it is no longer yours', () => {
    resolving.mockReturnValue('gone');
    renderNotice();

    expect(screen.getByText(GONE_FROM_INBOX)).toBeInTheDocument();
    expect(screen.queryByRole('article')).not.toBeInTheDocument();
  });

  it('shows its headline and every point, under the team it is about', () => {
    renderNotice();

    const card = screen.getByRole('article', {
      name: 'The search for a better Build config stalled',
    });
    const points = within(card).getByRole('list');
    expect(within(points).getAllByRole('listitem')).toHaveLength(2);
    expect(screen.getByRole('link', { name: 'Platform' })).toHaveAttribute(
      'href',
      '/w/acme/team/team_1',
    );
  });

  it('opens the page it links to, within its team, by the label it was sent with', () => {
    renderNotice();

    expect(
      screen.getByRole('link', { name: 'Open the station' }),
    ).toHaveAttribute(
      'href',
      '/w/acme/team/team_1/lines/line_1/stations/station_1',
    );
  });

  it('leads first to where to act outside Spotlight, in a new tab, then to its page in the team', () => {
    waiting.mockReturnValue([
      notice({
        externalLink: {
          url: 'https://github.com/acme/config/pull/7',
          label: 'Review the pull request',
        },
      }),
    ]);
    renderNotice();

    const card = screen.getByRole('article');
    const [first, second] = within(card).getAllByRole('link');

    expect(first).toHaveAccessibleName('Review the pull request');
    expect(first).toHaveAttribute(
      'href',
      'https://github.com/acme/config/pull/7',
    );
    expect(first).toHaveAttribute('target', '_blank');
    expect(first).toHaveAttribute('rel', 'noopener noreferrer');
    expect(second).toHaveAccessibleName('Open the station');
  });

  describe('resolving it on opening', () => {
    beforeEach(() => vi.useFakeTimers());
    afterEach(() => vi.useRealTimers());

    it('moves it to resolved a few seconds after opening it, once, as reading an email does', () => {
      renderNotice();

      expect(resolve).not.toHaveBeenCalled();

      act(() => vi.advanceTimersByTime(3000));

      expect(resolve).toHaveBeenCalledTimes(1);
      expect(resolve).toHaveBeenCalledWith({
        slug: 'acme',
        noticeId: 'notice_1',
      });
    });

    it('leaves it open once you unresolve it while you read it', () => {
      const { rerender } = renderNotice();

      act(() => vi.advanceTimersByTime(3000));
      waiting.mockReturnValue([notice({ resolved: true, unread: false })]);
      rerender(noticeAt());
      waiting.mockReturnValue([notice({ unread: false })]);
      rerender(noticeAt());
      act(() => vi.advanceTimersByTime(5000));

      expect(resolve).toHaveBeenCalledTimes(1);
    });

    it('leaves it open when you leave it within a few seconds', () => {
      const { unmount } = renderNotice();

      act(() => vi.advanceTimersByTime(2000));
      unmount();
      act(() => vi.advanceTimersByTime(5000));

      expect(resolve).not.toHaveBeenCalled();
    });

    it('leaves a notice already resolved alone', () => {
      waiting.mockReturnValue([notice({ resolved: true, unread: false })]);
      renderNotice();

      act(() => vi.advanceTimersByTime(5000));

      expect(resolve).not.toHaveBeenCalled();
    });
  });
});
