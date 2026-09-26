import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
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
  attachments: [],
  approval: null,
  failure: null,
});

const APPROVAL = {
  kind: 'tool-call' as const,
  name: 'linear.comment',
  because: 'It posts publicly, under the team’s name.',
  inputs: [
    { name: 'issue', value: 'ENG-12' },
    { name: 'body', value: 'Fixed in #41.' },
  ],
  standing: 'asked' as const,
};

const showing = (
  notes: ReturnType<typeof note>[],
  deciding?: { pending: boolean; onDecide: (approve: boolean) => void },
) =>
  render(
    <MemoryRouter>
      <Conversation
        deciding={deciding}
        item={{
          id: 'item_1',
          teamId: 'team_1',
          createdAt: AT,
          station: { name: 'Backlog', color: '#edc12b', position: 0, count: 4 },
          working: false,
          notes,
        }}
        worked={[]}
        footer={null}
      />
    </MemoryRouter>,
  );

describe('Conversation', () => {
  it('marks one moment once', () => {
    showing([note(0, AT)]);

    expect(screen.getAllByText(openedAt(AT))).toHaveLength(1);
  });

  it('names no station over a note that shows itself', () => {
    onboardingState.data = { steps: [] };
    showing([{ ...note(0, AT), form: 'setup' }]);

    expect(screen.queryByText('Backlog')).not.toBeInTheDocument();
    onboardingState.data = undefined;
  });

  it('names the station over an ordinary one', () => {
    showing([note(0, AT)]);

    expect(screen.getByText('Backlog')).toBeInTheDocument();
  });

  it('marks a later moment of its own', () => {
    showing([note(0, AT), note(1, LATER, 'Implementation')]);

    expect(screen.getAllByText(openedAt(AT))).toHaveLength(1);
    expect(screen.getAllByText(openedAt(LATER))).toHaveLength(1);
  });

  it('puts a tool call up for a decision, with what it would be called with', () => {
    showing([{ ...note(0, AT), form: 'approval', approval: APPROVAL }], {
      pending: false,
      onDecide: vi.fn(),
    });

    expect(
      screen.getByText('linear.comment needs your approval'),
    ).toBeInTheDocument();
    expect(screen.getByText(APPROVAL.because)).toBeInTheDocument();
    expect(screen.getByText('Fixed in #41.')).toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: 'Approve linear.comment' }),
    ).toBeInTheDocument();
  });

  it('says what the person decided instead of asking again', () => {
    showing(
      [
        {
          ...note(0, AT),
          form: 'approval',
          approval: { ...APPROVAL, standing: 'granted' },
        },
      ],
      { pending: false, onDecide: vi.fn() },
    );

    expect(screen.getByText('You approved this.')).toBeInTheDocument();
    expect(
      screen.queryByRole('button', { name: 'Approve linear.comment' }),
    ).not.toBeInTheDocument();
  });

  it('shows the tool call without a decision to make where nobody can make one', () => {
    showing([{ ...note(0, AT), form: 'approval', approval: APPROVAL }]);

    expect(
      screen.getByText('Waiting on a decision in the inbox.'),
    ).toBeInTheDocument();
    expect(
      screen.queryByRole('button', { name: 'Approve linear.comment' }),
    ).not.toBeInTheDocument();
  });

  it('hands the decision back with the reasoning given for it', async () => {
    const onDecide = vi.fn();
    showing([{ ...note(0, AT), form: 'approval', approval: APPROVAL }], {
      pending: false,
      onDecide,
    });

    await userEvent.type(
      screen.getByRole('textbox', {
        name: 'What to say about linear.comment',
      }),
      'Not before the release.',
    );
    await userEvent.click(
      screen.getByRole('button', { name: 'Reject linear.comment' }),
    );

    expect(onDecide).toHaveBeenCalledWith(false, 'Not before the release.');
  });
});
