import { render, screen, within } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { GONE_FROM_INBOX } from '@/lib/inbox';
import { InboxNotice } from '@/routes/InboxNotice';

const waiting = vi.fn();
const failing = vi.fn();
const settle = vi.fn();
const settling = vi.fn();

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

vi.mock('@/hooks/api/useSettleInboxNotice', () => ({
  useSettleInboxNotice: () => ({
    mutate: settle,
    isPending: false,
    isError: settling() !== null,
    error: settling() === 'gone' ? { status: 404 } : settling() && {},
  }),
}));

const notice = (over: Record<string, unknown> = {}) => ({
  kind: 'notice',
  id: 'notice_1',
  teamId: 'team_1',
  form: 'ended',
  headline: 'The search for a better Build config stalled',
  points: [
    'Fix the judge’s rubric: it asks for tests a rename never needs.',
    'Fix the station’s check: it needs a database the runner never starts.',
  ],
  link: 'lines/line_1/stations/station_1/searches/search_1',
  linkLabel: 'Open the reading',
  askedAt: '2026-08-29T13:00:00.000Z',
  unread: true,
  resolved: false,
  ...over,
});

const renderNotice = (noticeId = 'notice_1') =>
  render(
    <MemoryRouter initialEntries={[`/w/acme/inbox/notices/${noticeId}`]}>
      <Routes>
        <Route
          path="/w/:slug/inbox/notices/:noticeId"
          element={<InboxNotice />}
        />
      </Routes>
    </MemoryRouter>,
  );

describe('InboxNotice', () => {
  beforeEach(() => {
    waiting.mockReturnValue([notice()]);
    failing.mockReturnValue(false);
    settling.mockReturnValue(null);
    settle.mockClear();
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
    settling.mockReturnValue('gone');
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
      screen.getByRole('link', { name: 'Open the reading' }),
    ).toHaveAttribute(
      'href',
      '/w/acme/team/team_1/lines/line_1/stations/station_1/searches/search_1',
    );
  });

  it('moves it to resolved on opening it, once, as reading an email does', () => {
    renderNotice();

    expect(settle).toHaveBeenCalledTimes(1);
    expect(settle).toHaveBeenCalledWith({ slug: 'acme', noticeId: 'notice_1' });
  });

  it('leaves a notice already resolved alone', () => {
    waiting.mockReturnValue([notice({ resolved: true, unread: false })]);
    renderNotice();

    expect(settle).not.toHaveBeenCalled();
  });
});
