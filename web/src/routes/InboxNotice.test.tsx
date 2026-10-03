import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  GONE_FROM_INBOX,
  NOTICE_DISMISS,
  NOTICE_DISMISS_FAILED,
  NOTICE_DISMISSED,
} from '@/lib/inbox';
import { InboxNotice } from '@/routes/InboxNotice';

const waiting = vi.fn();
const failing = vi.fn();
const read = vi.fn();
const settle = vi.fn();
const settling = vi.fn();
const readError = vi.fn();

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

vi.mock('@/hooks/api/useReadInboxNotice', () => ({
  useReadInboxNotice: () => ({ mutate: read, error: readError() }),
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
    readError.mockReturnValue(null);
    read.mockClear();
    settle.mockClear();
  });

  it('holds the notice’s place while the inbox loads', () => {
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

  it('says nothing is waiting where reading it finds it is no longer yours', () => {
    readError.mockReturnValue({ status: 404 });
    renderNotice();

    expect(screen.getByText(GONE_FROM_INBOX)).toBeInTheDocument();
  });

  it('says nothing is waiting where dismissing it finds it is no longer yours', () => {
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

  it('marks it read on opening it, once', () => {
    renderNotice();

    expect(read).toHaveBeenCalledTimes(1);
    expect(read).toHaveBeenCalledWith({ slug: 'acme', noticeId: 'notice_1' });
  });

  it('leaves a notice already read alone', () => {
    waiting.mockReturnValue([notice({ unread: false })]);
    renderNotice();

    expect(read).not.toHaveBeenCalled();
  });

  it('dismisses it when asked', async () => {
    const person = userEvent.setup();
    renderNotice();

    await person.click(screen.getByRole('button', { name: NOTICE_DISMISS }));

    expect(settle).toHaveBeenCalledWith({ slug: 'acme', noticeId: 'notice_1' });
  });

  it('says so when it could not be dismissed', () => {
    settling.mockReturnValue('failed');
    renderNotice();

    expect(screen.getByRole('alert')).toHaveTextContent(NOTICE_DISMISS_FAILED);
  });

  it('offers no dismissal once dismissed', () => {
    waiting.mockReturnValue([notice({ resolved: true, unread: false })]);
    renderNotice();

    expect(
      screen.queryByRole('button', { name: NOTICE_DISMISS }),
    ).not.toBeInTheDocument();
    expect(screen.getByText(NOTICE_DISMISSED)).toBeInTheDocument();
  });
});
