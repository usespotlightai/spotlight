import { render, screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router';
import { describe, expect, it, vi } from 'vitest';
import { Memory } from '@/routes/Memory';

vi.mock('@/hooks/api/useWorkspace', () => ({
  useWorkspace: () => ({
    data: { teams: [{ id: 'team_1', name: 'Platform' }] },
    isPending: false,
  }),
}));
vi.mock('@/hooks/api/useLines', () => ({
  useLines: () => ({ data: [] }),
}));
vi.mock('@/hooks/api/useTeamMemories', () => ({
  useTeamMemories: () => ({ data: [] }),
}));
vi.mock('@/components/features/memory/TeamMemory', () => ({
  TeamMemory: () => <p>The team’s memory</p>,
}));
vi.mock('@/components/features/memory/WriteMemoryButton', () => ({
  WriteMemoryButton: () => <button type="button">Write a memory</button>,
}));

const showing = (search = '') =>
  render(
    <MemoryRouter initialEntries={[`/w/acme/team/team_1/memory${search}`]}>
      <Routes>
        <Route path="/w/:slug/team/:teamId/memory" element={<Memory />} />
      </Routes>
    </MemoryRouter>,
  );

describe('Memory', () => {
  it('opens the team’s memory with filtering and writing in the header', () => {
    showing();

    expect(
      screen.getByRole('heading', { name: /Platform\s*Memory/ }),
    ).toBeInTheDocument();
    expect(screen.getByText('The team’s memory')).toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: 'Filter memories' }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: 'Write a memory' }),
    ).toBeInTheDocument();
  });

  it('keeps the filters when a link opens one memory', () => {
    showing('?memory=memory_9');

    expect(
      screen.getByRole('button', { name: /Filter memories/ }),
    ).toBeInTheDocument();
  });
});
