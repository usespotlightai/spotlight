import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router';
import { describe, expect, it, vi } from 'vitest';
import { Conversation } from '@/components/features/inbox/conversation/Conversation';
import { type InboxMessage, openedAt } from '@/lib/inbox';

vi.mock('@/hooks/api/useSession', () => ({
  useSession: () => ({ data: { user: { id: 'user_1' } } }),
}));

const onboardingState = { data: undefined as unknown };

vi.mock('@/hooks/api/useOnboarding', () => ({
  useOnboarding: () => onboardingState,
}));

vi.mock('@/hooks/api/useRepositories', () => ({
  useRepositories: () => ({ data: [] }),
}));

vi.mock('@/hooks/api/usePinConfiguration', () => ({
  usePinConfiguration: () => ({ mutate: vi.fn(), isPending: false }),
}));

const AT = '2026-09-03T21:22:00.000Z';
const LATER = '2026-09-03T23:45:00.000Z';

const note = (
  position: number,
  at: string,
  station = 'Backlog',
): InboxMessage => ({
  position,
  kind: 'asked',
  form: 'words',
  voice: 'station',
  station,
  stationColor: '#edc12b',
  stationPosition: 0,
  runId: null,
  body: `note ${position}`,
  at,
  author: null,
});

const showing = (notes: ReturnType<typeof note>[]) =>
  render(
    <MemoryRouter>
      <Conversation
        item={{
          id: 'item_1',
          teamId: 'team_1',
          createdAt: AT,
          station: { name: 'Backlog', color: '#edc12b', position: 0, count: 4 },
          working: false,
          notes,
        }}
        worked={[]}
        viewerId="user_1"
        footer={null}
      />
    </MemoryRouter>,
  );

describe('Conversation', () => {
  // A note raised with the conversation it opens carries the same moment.
  it('marks one moment once', () => {
    showing([note(0, AT)]);

    expect(screen.getAllByText(openedAt(AT))).toHaveLength(1);
  });

  // Spotlight speaking for itself stands under no station's name.
  it('names no station over a note that shows itself', () => {
    onboardingState.data = {
      steps: [],
      connectedToGitHub: false,
      configRepository: null,
      installUrl: null,
      tools: [],
    };
    showing([{ ...note(0, AT), form: 'setup' }]);

    expect(screen.queryByText('Backlog')).not.toBeInTheDocument();
    onboardingState.data = undefined;
  });

  it('names the station over an ordinary one', () => {
    showing([note(0, AT)]);

    expect(screen.getByText('Backlog')).toBeInTheDocument();
  });

  // A mark stands where the line moved on, and only where it reads anew.
  it('marks a later moment of its own', () => {
    showing([note(0, AT), note(1, LATER, 'Implementation')]);

    expect(screen.getAllByText(openedAt(AT))).toHaveLength(1);
    expect(screen.getAllByText(openedAt(LATER))).toHaveLength(1);
  });
});
