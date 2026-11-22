import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { MemoryUpkeepReview } from '@/components/features/memory/upkeep/MemoryUpkeepReview';
import type { MemoryUpkeep, UpkeepProposal } from '@/lib/memory-upkeep';

const found = {
  data: undefined as MemoryUpkeep | undefined,
  isPending: false,
  isFetching: false,
  errorUpdateCount: 0,
  error: null,
  refetch: vi.fn(),
};
const decide = { mutate: vi.fn(), isPending: false, variables: undefined };

vi.mock('@/hooks/api/useMemoryUpkeep', () => ({
  useMemoryUpkeep: () => found,
  useDecideUpkeepProposal: () => decide,
}));

const proposal = (over: Partial<UpkeepProposal>): UpkeepProposal => ({
  id: 'p_1',
  change: 'retire',
  finding: 'unused',
  reason: 'No run used it in 90 days.',
  state: 'pending',
  body: null,
  memories: [
    {
      id: 'memory_1',
      handle: 'M-1',
      kind: 'preference',
      body: 'Name branches after the ticket.',
      status: 'active',
    },
  ],
  decidedBy: null,
  decidedAt: null,
  inactiveMemories: [],
  ...over,
});

const showing = (proposals: UpkeepProposal[]) => {
  found.data = {
    id: 'upkeep_1',
    teamId: 'team_1',
    sweptAt: '2026-11-21T10:00:00.000Z',
    proposals,
  };
  return render(
    <MemoryRouter>
      <MemoryUpkeepReview slug="acme" teamId="team_1" upkeepId="upkeep_1" />
    </MemoryRouter>,
  );
};

beforeEach(() => decide.mutate.mockReset());

describe('MemoryUpkeepReview', () => {
  it('retires a memory once a person approves the change', async () => {
    showing([proposal({})]);

    await userEvent.click(screen.getByRole('button', { name: 'Retire M-1' }));

    expect(decide.mutate).toHaveBeenCalledWith(
      expect.objectContaining({ proposalId: 'p_1', decision: 'approved' }),
    );
  });

  it('keeps a memory when a person rejects the change', async () => {
    showing([proposal({})]);

    await userEvent.click(screen.getByRole('button', { name: 'Keep M-1' }));

    expect(decide.mutate).toHaveBeenCalledWith(
      expect.objectContaining({ decision: 'rejected' }),
    );
  });

  it('offers only Keep when a memory was retired after the sweep', () => {
    showing([
      proposal({
        inactiveMemories: ['M-1'],
        memories: [
          {
            id: 'memory_1',
            handle: 'M-1',
            kind: 'preference',
            body: 'Name branches after the ticket.',
            status: 'retired',
          },
        ],
      }),
    ]);

    expect(
      screen
        .getByRole('button', { name: 'Retire M-1' })
        .hasAttribute('disabled'),
    ).toBe(true);
    expect(
      screen.getByText(
        'M-1 was retired after the sweep, so this change no longer applies.',
      ),
    ).toBeTruthy();
  });

  it('shows what a merge writes, and no controls once decided', () => {
    showing([
      proposal({
        change: 'merge',
        finding: 'overlap',
        body: 'One rule.',
        state: 'approved',
        decidedBy: { id: 'user_1', name: 'Ada' },
      }),
    ]);

    expect(screen.getByText('One rule.')).toBeTruthy();
    expect(screen.getByText('Merged M-1 by Ada')).toBeTruthy();
    expect(screen.queryByRole('button', { name: /Merge/ })).toBeNull();
    expect(screen.getByText('Each change is decided.')).toBeTruthy();
  });

  it('names an approved change that a later change made no longer apply', () => {
    showing([
      proposal({
        state: 'lapsed',
        decidedBy: { id: 'user_1', name: 'Ada' },
      }),
    ]);

    expect(screen.getByText('No longer applies to M-1')).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'Retire M-1' })).toBeNull();
  });
});
