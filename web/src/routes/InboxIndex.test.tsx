import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { InboxIndex } from '@/routes/InboxIndex';

const waiting = vi.fn();
const failing = vi.fn();
const refetch = vi.fn();

vi.mock('@/hooks/api/useInbox', () => ({
  useInbox: () => ({
    data: failing() ? undefined : waiting(),
    isPending: false,
    errorUpdateCount: failing() ? 1 : 0,
    isFetching: false,
    refetch,
  }),
}));

vi.mock('@/hooks/api/useWorkspace', () => ({
  useWorkspace: () => ({
    data: { teams: [{ id: 'team_1', name: 'Platform' }] },
  }),
}));

vi.mock('@/hooks/api/useLines', () => ({
  useLines: () => ({
    data: [
      { id: 'line_1', name: 'Delivery', stations: [] },
      { id: 'line_2', name: 'Factory', stations: [] },
    ],
  }),
}));

const renderIndex = () =>
  render(
    <MemoryRouter initialEntries={['/w/acme/inbox']}>
      <Routes>
        <Route path="/w/:slug/inbox" element={<InboxIndex />} />
      </Routes>
    </MemoryRouter>,
  );

describe('InboxIndex', () => {
  beforeEach(() => {
    waiting.mockReturnValue([{ id: 'task_1:0' }]);
    failing.mockReturnValue(false);
    refetch.mockClear();
  });

  it('asks for a task beneath a bar of its own', () => {
    const { container } = renderIndex();

    expect(container.querySelector('header')).toBeInTheDocument();
    expect(
      screen.getByText('Pick a task to see what it is waiting on.'),
    ).toBeInTheDocument();
  });

  describe('when nothing is waiting', () => {
    beforeEach(() => {
      waiting.mockReturnValue([]);
    });

    it('says there are no messages', () => {
      renderIndex();

      expect(screen.getByText('No messages')).toBeInTheDocument();
      expect(screen.queryByText(/Pick a task/)).not.toBeInTheDocument();
    });

    it('sends you to the first line to create a task', () => {
      renderIndex();

      expect(
        screen.getByRole('link', { name: 'Create a task' }),
      ).toHaveAttribute('href', '/w/acme/team/team_1/lines/line_1');
    });
  });

  it('says the inbox could not be loaded, and tries again when asked', async () => {
    const person = userEvent.setup();
    failing.mockReturnValue(true);
    const { container } = renderIndex();

    expect(container.querySelector('header')).toBeInTheDocument();
    expect(screen.getByRole('alert')).toHaveTextContent(
      'The inbox could not be loaded.',
    );
    expect(screen.queryByText('No messages')).not.toBeInTheDocument();

    await person.click(screen.getByRole('button', { name: 'Try again' }));

    expect(refetch).toHaveBeenCalled();
  });
});
