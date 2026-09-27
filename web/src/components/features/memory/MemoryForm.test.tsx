import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { MemoryForm } from '@/components/features/memory/MemoryForm';
import type { LineResponseDto } from '@/lib/api';
import type { TeamMemory } from '@/lib/memory';

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

const showing = (initial: TeamMemory | null = null) => {
  const onSave = vi.fn();
  render(
    <MemoryForm
      open
      onOpenChange={() => undefined}
      title="Write a memory"
      submitLabel="Keep it"
      initial={initial}
      lines={LINES}
      pending={false}
      failed={false}
      onSave={onSave}
    />,
  );
  return onSave;
};

describe('MemoryForm', () => {
  it('keeps a memory for the whole team by default', async () => {
    const onSave = showing();

    await userEvent.type(
      screen.getByRole('textbox', { name: 'What the team should remember' }),
      '  Name branches after the ticket.  ',
    );
    await userEvent.click(screen.getByRole('button', { name: 'Keep it' }));

    expect(onSave).toHaveBeenCalledWith({
      kind: 'preference',
      body: 'Name branches after the ticket.',
      lineId: null,
      stationId: null,
      repository: null,
      paths: [],
    });
  });

  it('keeps nothing without saying what to remember', () => {
    showing();

    expect(screen.getByRole('button', { name: 'Keep it' })).toBeDisabled();
  });

  it('offers a station and paths only once a line and repository are chosen', () => {
    showing();

    expect(screen.getByRole('button', { name: /^Station/ })).toBeDisabled();
    expect(screen.getByRole('textbox', { name: 'Paths' })).toBeDisabled();
  });

  it('starts from the memory it corrects, keeping where it applies', async () => {
    const onSave = showing({
      id: 'memory_1',
      handle: 'M-1',
      kind: 'rationale',
      body: 'Retry uploads from a queue.',
      source: 'run',
      standing: 'stands',
      reach: 'station',
      lineId: 'line_delivery',
      stationId: 'station_build',
      repository: 'acme/api',
      paths: ['src/uploads.ts', 'src/retry.ts'],
      approvedBy: { id: 'user_2', name: 'Maya Chen' },
      approvedAt: '2026-09-27T10:00:00.000Z',
      supersedes: null,
      retirement: null,
      grounds: null,
    });

    const body = screen.getByRole('textbox', {
      name: 'What the team should remember',
    });
    await userEvent.clear(body);
    await userEvent.type(body, 'Retry uploads in the request.');
    await userEvent.click(screen.getByRole('button', { name: 'Keep it' }));

    expect(onSave).toHaveBeenCalledWith({
      kind: 'rationale',
      body: 'Retry uploads in the request.',
      lineId: 'line_delivery',
      stationId: 'station_build',
      repository: 'acme/api',
      paths: ['src/uploads.ts', 'src/retry.ts'],
    });
  });
});
