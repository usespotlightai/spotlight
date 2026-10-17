import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { NewMemoryRow } from '@/components/features/memory/NewMemoryRow';
import type { LineResponseDto } from '@/lib/api';

const mutate = vi.fn();

vi.mock('@/hooks/api/useWriteMemory', () => ({
  useWriteMemory: () => ({ mutate, isPending: false }),
}));
vi.mock('@/hooks/api/useSession', () => ({
  useSession: () => ({ data: { user: { name: 'Ada Lovelace', image: null } } }),
}));

const LINES = [
  {
    id: 'line_delivery',
    key: 'delivery',
    name: 'Delivery',
    stations: [{ id: 'station_build', name: 'Implementation', kind: 'work' }],
    reactions: [],
    repositories: ['acme/api'],
  },
] as unknown as LineResponseDto[];

const onDone = vi.fn();

const showing = () =>
  render(
    <ul>
      <NewMemoryRow teamId="team_1" lines={LINES} onDone={onDone} />
    </ul>,
  );

beforeEach(() => {
  mutate.mockReset();
  onDone.mockReset();
});

describe('NewMemoryRow', () => {
  it('writes a memory for the whole team by default, approved by whoever writes it', async () => {
    showing();

    expect(screen.getByText('Ada Lovelace')).toBeInTheDocument();

    await userEvent.type(
      screen.getByRole('textbox', { name: 'What the team should remember' }),
      '  Name branches after the ticket.  ',
    );
    await userEvent.click(screen.getByRole('button', { name: 'Save' }));

    expect(mutate).toHaveBeenCalledWith(
      {
        teamId: 'team_1',
        memory: {
          kind: 'preference',
          body: 'Name branches after the ticket.',
          lineId: null,
          stationId: null,
          repository: null,
          paths: [],
        },
      },
      { onSuccess: onDone },
    );
  });

  it('saves nothing without saying what to remember', () => {
    showing();

    expect(screen.getByRole('button', { name: 'Save' })).toBeDisabled();
  });

  it('offers a station and paths only once a line and repository are chosen', () => {
    showing();

    expect(screen.getByRole('button', { name: /^Station/ })).toBeDisabled();
    expect(screen.getByRole('textbox', { name: 'Paths' })).toBeDisabled();
  });

  it('gives up on Escape', async () => {
    showing();

    await userEvent.type(
      screen.getByRole('textbox', { name: 'What the team should remember' }),
      '{Escape}',
    );

    expect(onDone).toHaveBeenCalled();
  });
});
