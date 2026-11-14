import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

import { RecentPagesButton } from '@/components/shell/tabs/RecentPagesButton';
import type { RecentPage } from '@/lib/recent-pages';

const PAGES: readonly RecentPage[] = [
  {
    path: '/w/acme/team/t1/tasks/k1',
    title: 'Fix the queue',
    label: 'SPO-272',
  },
  { path: '/w/acme/team/t1/runs/r1', title: 'Run 4' },
  { path: '/w/acme/inbox', title: null },
];

const renderButton = (pages: readonly RecentPage[] = PAGES) => {
  const onSelect = vi.fn();
  render(<RecentPagesButton pages={pages} onSelect={onSelect} />);

  return onSelect;
};

const trigger = () => screen.getByRole('button', { name: 'Recently viewed' });

describe('RecentPagesButton', () => {
  it('shows a closed button until it is used', () => {
    renderButton();

    expect(trigger()).toBeInTheDocument();
    expect(screen.queryByText('Fix the queue')).toBeNull();
  });

  it('lists each page with its label and title', async () => {
    renderButton();

    await userEvent.setup().click(trigger());

    expect(
      await screen.findByRole('heading', { name: 'Recently viewed' }),
    ).toBeInTheDocument();
    expect(screen.getAllByRole('option').map((row) => row.textContent)).toEqual(
      ['SPO-272Fix the queue', 'RunRun 4', 'InboxInbox'],
    );
  });

  it('says so when no page was viewed yet', async () => {
    renderButton([]);

    await userEvent.setup().click(trigger());

    expect(await screen.findByText('No pages viewed yet.')).toBeInTheDocument();
    expect(screen.queryAllByRole('option')).toHaveLength(0);
  });

  it('opens with Enter', async () => {
    renderButton();
    const user = userEvent.setup();

    await user.tab();
    await user.keyboard('{Enter}');

    expect(await screen.findAllByRole('option')).toHaveLength(3);
  });

  it('opens with Space', async () => {
    renderButton();
    const user = userEvent.setup();

    await user.tab();
    await user.keyboard(' ');

    expect(await screen.findAllByRole('option')).toHaveLength(3);
  });

  it('moves between rows with the arrow keys and picks one with Enter', async () => {
    const onSelect = renderButton();
    const user = userEvent.setup();

    await user.click(trigger());
    await screen.findAllByRole('option');
    await user.keyboard('{ArrowDown}{Enter}');

    expect(onSelect).toHaveBeenCalledWith('/w/acme/team/t1/runs/r1');
  });

  it('closes with Escape', async () => {
    renderButton();
    const user = userEvent.setup();

    await user.click(trigger());
    await screen.findAllByRole('option');
    await user.keyboard('{Escape}');

    await waitFor(() =>
      expect(screen.queryAllByRole('option')).toHaveLength(0),
    );
  });

  it('opens the page of a clicked row, and closes', async () => {
    const onSelect = renderButton();
    const user = userEvent.setup();

    await user.click(trigger());
    await user.click(
      await screen.findByRole('option', { name: /Fix the queue/ }),
    );

    expect(onSelect).toHaveBeenCalledExactlyOnceWith(
      '/w/acme/team/t1/tasks/k1',
    );
    await waitFor(() =>
      expect(screen.queryAllByRole('option')).toHaveLength(0),
    );
  });
});
