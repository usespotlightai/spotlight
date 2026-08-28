import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { StartSession } from '@/components/runners/StartSession';
import type { Runner } from '@/lib/runner';

vi.mock('@/hooks/api/useHarnesses', () => ({
  useHarnesses: () => ({
    data: [
      { id: 'claude-code', name: 'Claude Code' },
      { id: 'other', name: 'Other Harness' },
    ],
  }),
}));

const having = (...harnesses: string[]) =>
  ({ id: 'runner_1', name: 'Laptop', harnesses }) as unknown as Runner;

describe('StartSession', () => {
  // Nothing to ask about when there is only one, so it says what it starts
  // rather than making a person open a menu to find out.
  it('starts the only harness the runner has, by name', async () => {
    const started = vi.fn();
    render(
      <StartSession
        runner={having('claude-code')}
        starting={false}
        onStart={started}
      />,
    );

    await userEvent.click(
      screen.getByRole('button', { name: 'Start Claude Code' }),
    );

    expect(started).toHaveBeenCalledWith('claude-code');
  });

  it('offers a choice when the runner has several', async () => {
    const started = vi.fn();
    const user = userEvent.setup();

    render(
      <StartSession
        runner={having('claude-code', 'other')}
        starting={false}
        onStart={started}
      />,
    );

    await user.click(screen.getByRole('button', { name: /Start session/ }));
    await screen.findByRole('menu');
    await user.click(screen.getByRole('menuitem', { name: 'Other Harness' }));

    expect(started).toHaveBeenCalledWith('other');
  });

  // A runner that has connected and found nothing has nothing to start, and
  // saying so beats a button that cannot work.
  it('says so when the runner reported nothing it can start', () => {
    render(
      <StartSession runner={having()} starting={false} onStart={vi.fn()} />,
    );

    expect(screen.getByText(/reported no harnesses/)).toBeInTheDocument();
    expect(screen.queryByRole('button')).not.toBeInTheDocument();
  });

  // Spotlight may not know a harness a machine happens to have; naming it by
  // its id is more use than leaving it out.
  it('offers a harness it has no name for', async () => {
    const user = userEvent.setup();
    render(
      <StartSession
        runner={having('claude-code', 'home-grown')}
        starting={false}
        onStart={vi.fn()}
      />,
    );

    await user.click(screen.getByRole('button', { name: /Start session/ }));
    await screen.findByRole('menu');

    expect(
      screen.getByRole('menuitem', { name: 'home-grown' }),
    ).toBeInTheDocument();
  });
});
