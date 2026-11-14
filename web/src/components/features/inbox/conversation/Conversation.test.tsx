import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router';
import { describe, expect, it, vi } from 'vitest';

import {
  type AfterRun,
  Conversation,
  type Deciding,
} from '@/components/features/inbox/conversation/Conversation';
import { type Note, openedAt } from '@/lib/inbox';
import type { ShownProgress } from '@/lib/run';

vi.mock('@/hooks/api/useSession', () => ({
  useSession: () => ({ data: { user: { id: 'user_1' } } }),
}));

const onboardingState = { data: undefined as unknown };

vi.mock('@/hooks/api/useOnboarding', () => ({
  useOnboarding: () => onboardingState,
}));

vi.mock('@/hooks/api/useGitHub', () => ({
  useGitHub: () => ({ data: undefined }),
}));

vi.mock('@/hooks/api/useRepositories', () => ({
  useRepositories: () => ({ data: [] }),
}));

const AT = '2026-09-03T21:22:00.000Z';
const LATER = '2026-09-03T23:45:00.000Z';

const note = (position: number, at: string, station = 'Backlog'): Note => ({
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
  coAuthors: [],
  source: null,
  deferredTo: null,
  attachments: [],
  approval: null,
  failure: null,
  connection: null,
});

const APPROVAL = {
  kind: 'tool-call' as const,
  name: 'linear.comment',
  because: 'It posts publicly, under the team’s name.',
  inputs: [
    { name: 'issue', value: 'ENG-12' },
    { name: 'body', value: 'Fixed in #41.' },
  ],
  status: 'pending' as const,
  edited: null,
  intent: null,
  askedOf: null,
};

const CLOSING: AfterRun = {
  runId: 'run_1',
  content: <p>How the run went</p>,
};

const expectInOrder = (...texts: string[]) => {
  const shown = texts.map((text) => screen.getByText(text));

  for (const [at, each] of shown.slice(1).entries()) {
    expect(
      shown[at]?.compareDocumentPosition(each) &
        Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy();
  }
};

const showing = (
  notes: ReturnType<typeof note>[],
  deciding?: Deciding,
  afterRun?: AfterRun,
  progress: ShownProgress | null = null,
) =>
  render(
    <QueryClientProvider client={new QueryClient()}>
      <MemoryRouter>
        <Conversation
          deciding={deciding}
          afterRun={afterRun}
          item={{
            id: 'item_1',
            teamId: 'team_1',
            createdAt: AT,
            station: {
              name: 'Backlog',
              color: '#edc12b',
              position: 0,
              count: 4,
            },
            progress,
            notes,
          }}
          worked={[]}
          footer={null}
        />
      </MemoryRouter>
    </QueryClientProvider>,
  );

describe('Conversation', () => {
  it('marks one moment once', () => {
    showing([note(0, AT)]);

    expect(screen.getAllByText(openedAt(AT))).toHaveLength(1);
  });

  it('shows nothing for resolving and reopening', () => {
    const person = { voice: 'person' as const, kind: 'passed' as const };
    showing([
      note(0, AT),
      { ...note(1, LATER), ...person, form: 'resolved', body: 'Resolved.' },
      { ...note(2, LATER), ...person, kind: 'reopened', body: 'Reopened.' },
    ]);

    expect(screen.queryByText('Resolved.')).not.toBeInTheDocument();
    expect(screen.queryByText('Reopened.')).not.toBeInTheDocument();
    expect(screen.queryByText(openedAt(LATER))).not.toBeInTheDocument();
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

  it('puts a tool call up as the action itself, ready to run', () => {
    showing([{ ...note(0, AT), form: 'approval', approval: APPROVAL }], {
      pending: false,
      onDecide: vi.fn(),
    });

    expect(screen.getByText('Fixed in #41.')).toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: 'Approve linear.comment' }),
    ).toBeInTheDocument();
  });

  it('hands what the person decided back to whoever answers it', async () => {
    const onDecide = vi.fn();
    showing([{ ...note(0, AT), form: 'approval', approval: APPROVAL }], {
      pending: false,
      onDecide,
    });

    await userEvent.click(
      screen.getByRole('button', { name: 'Approve linear.comment' }),
    );

    expect(onDecide).toHaveBeenCalledWith({ approve: true, body: '' });
  });

  it('shows the tool call without a decision to make where nobody can make one', () => {
    showing([{ ...note(0, AT), form: 'approval', approval: APPROVAL }]);

    expect(
      screen.getByRole('button', { name: 'Approve linear.comment' }),
    ).toBeDisabled();
    expect(
      screen.getByRole('button', { name: 'Dismiss linear.comment' }),
    ).toBeDisabled();
  });

  it('closes a run once, after its last note, when a person answers in between', () => {
    const ran = { ...note(0, AT), runId: 'run_1' };
    showing(
      [
        ran,
        { ...note(1, LATER), voice: 'person', body: 'Go ahead' },
        { ...ran, position: 2, body: 'Done', at: LATER },
      ],
      undefined,
      CLOSING,
    );

    const closing = screen.getAllByText('How the run went');
    expect(closing).toHaveLength(1);
    expect(
      screen.getByText('Done').compareDocumentPosition(closing[0]) &
        Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy();
  });

  it('closes a run after its last shown note when a resolving note of it comes later', () => {
    const ran = { ...note(0, AT), runId: 'run_1', body: 'Done' };
    showing(
      [
        ran,
        {
          ...ran,
          position: 1,
          voice: 'person',
          kind: 'passed',
          form: 'resolved',
          body: 'Resolved.',
          at: LATER,
        },
      ],
      undefined,
      CLOSING,
    );

    const closing = screen.getAllByText('How the run went');
    expect(closing).toHaveLength(1);
    expect(
      screen.getByText('Done').compareDocumentPosition(closing[0]) &
        Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy();
  });

  it('closes a run that has said nothing yet after the last note, above the working line', () => {
    showing([note(0, AT)], undefined, CLOSING, 'in-progress');

    expect(screen.getAllByText('How the run went')).toHaveLength(1);
    expectInOrder('note 0', 'How the run went', 'Backlog is working…');
  });

  it('closes a run where its hidden last note was, before a later run', () => {
    showing(
      [
        { ...note(0, AT), runId: 'run_0', body: 'Before' },
        {
          ...note(1, LATER),
          runId: 'run_1',
          voice: 'person',
          kind: 'passed',
          form: 'resolved',
          body: 'Resolved.',
        },
        { ...note(2, LATER), runId: 'run_2', body: 'Later' },
      ],
      undefined,
      CLOSING,
    );

    expect(screen.getAllByText('How the run went')).toHaveLength(1);
    expectInOrder('Before', 'How the run went', 'Later');
  });

  it('closes a run under the message that ended it, before a later run', () => {
    showing(
      [
        { ...note(0, AT), runId: 'run_1', body: 'Asked' },
        {
          ...note(1, LATER),
          runId: 'run_1',
          voice: 'person',
          body: 'Go ahead',
        },
        { ...note(2, LATER), runId: 'run_2', body: 'Later' },
      ],
      undefined,
      CLOSING,
    );

    expect(screen.getAllByText('How the run went')).toHaveLength(1);
    expectInOrder('Go ahead', 'How the run went', 'Later');
  });

  it('shows what the station said in an older turn', () => {
    showing([
      note(0, AT),
      { ...note(1, LATER), voice: 'person', body: 'Go ahead' },
      note(2, LATER),
    ]);

    expect(screen.getAllByLabelText('What Backlog said')).toHaveLength(2);
    expect(
      screen.queryByRole('button', { name: /note 0/ }),
    ).not.toBeInTheDocument();
  });

  it('lets only the notes that come later arrive, not the ones it opened with', () => {
    const client = new QueryClient();
    const conversation = (notes: Note[]) => (
      <QueryClientProvider client={client}>
        <MemoryRouter>
          <Conversation
            item={{
              id: 'item_1',
              teamId: 'team_1',
              createdAt: AT,
              station: {
                name: 'Backlog',
                color: '#edc12b',
                position: 0,
                count: 4,
              },
              progress: null,
              notes,
            }}
            worked={[]}
            footer={null}
          />
        </MemoryRouter>
      </QueryClientProvider>
    );
    const { rerender } = render(conversation([note(0, AT)]));

    rerender(conversation([note(0, AT), note(1, AT)]));

    const arrives = (body: string) =>
      screen.getByText(body).closest('li')?.className.includes('animate-in');
    expect(arrives('note 0')).toBe(false);
    expect(arrives('note 1')).toBe(true);
  });
});
