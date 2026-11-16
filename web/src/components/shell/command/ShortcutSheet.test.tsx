import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it } from 'vitest';

import { ShortcutSheet } from '@/components/shell/command/ShortcutSheet';

const rowOf = (title: string) =>
  screen.getByText(title).closest('[data-slot="shortcut-row"]') as HTMLElement;

describe('ShortcutSheet', () => {
  afterEach(() => {
    Reflect.deleteProperty(window, 'spotlightDesktop');
  });

  it('lists the shortcuts by group', () => {
    render(<ShortcutSheet open onOpenChange={() => {}} />);

    for (const group of ['General', 'Navigation', 'Lists', 'Tasks', 'Inbox']) {
      expect(screen.getByRole('region', { name: group })).toBeInTheDocument();
    }
    expect(
      within(screen.getByRole('region', { name: 'Tasks' })).getByText('Assign'),
    ).toBeInTheDocument();
  });

  it('shows a sequence as one key, then the next', () => {
    render(<ShortcutSheet open onOpenChange={() => {}} />);

    expect(rowOf('Go to Inbox')).toHaveTextContent(/G\s*then\s*I/);
  });

  it('keeps only the shortcuts that match the search', async () => {
    const user = userEvent.setup();
    render(<ShortcutSheet open onOpenChange={() => {}} />);

    await user.type(
      screen.getByRole('searchbox', { name: 'Search shortcuts' }),
      'go to',
    );

    expect(screen.getByText('Go to Inbox')).toBeInTheDocument();
    expect(screen.queryByText('Assign')).not.toBeInTheDocument();
  });

  it('says so when no shortcut matches', async () => {
    const user = userEvent.setup();
    render(<ShortcutSheet open onOpenChange={() => {}} />);

    await user.type(
      screen.getByRole('searchbox', { name: 'Search shortcuts' }),
      'nothing like this',
    );

    expect(screen.getByText('No shortcuts match.')).toBeInTheDocument();
  });

  it('adds the keys of the desktop app inside the app', () => {
    Object.assign(window, {
      spotlightDesktop: {
        platform: 'darwin',
        setBadge() {},
        show() {},
        authorize() {},
      },
    });
    render(<ShortcutSheet open onOpenChange={() => {}} />);

    expect(
      within(screen.getByRole('region', { name: 'Desktop app' })).getByText(
        'New tab',
      ),
    ).toBeInTheDocument();
  });

  it('keeps the keys of the desktop app out of a browser', () => {
    render(<ShortcutSheet open onOpenChange={() => {}} />);

    expect(
      screen.queryByRole('region', { name: 'Desktop app' }),
    ).not.toBeInTheDocument();
  });
});
