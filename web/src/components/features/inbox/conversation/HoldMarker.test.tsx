import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { HoldMarker } from '@/components/features/inbox/conversation/HoldMarker';
import type { Note } from '@/lib/inbox';

const note = (over: Partial<Note>): Note => ({
  position: 3,
  kind: 'message',
  form: 'resumed',
  voice: 'person',
  station: 'Implementation',
  stationColor: '#5c66d9',
  stationPosition: 2,
  runId: null,
  body: '',
  attachments: [],
  at: '2026-11-16T09:00:00.000Z',
  author: { id: 'user_1', name: 'Sam Rivera', image: null },
  coAuthors: [],
  source: null,
  deferredTo: null,
  approval: null,
  failure: null,
  connection: null,
  resumption: null,
  ...over,
});

describe('HoldMarker', () => {
  it('says who put the task on hold', () => {
    render(<HoldMarker note={note({ form: 'held' })} />);

    expect(
      screen.getByText('Sam Rivera put the task on hold.'),
    ).toBeInTheDocument();
  });

  it('says where the task went after the line resumed, and shows the summary', () => {
    render(
      <HoldMarker
        note={note({
          resumption: {
            next: 'move-on',
            station: 'Review',
            summary: 'I bounded the queue.',
          },
        })}
      />,
    );

    expect(
      screen.getByText('Sam Rivera resumed the line. It moved to Review.'),
    ).toBeInTheDocument();
    expect(screen.getByText('I bounded the queue.')).toBeInTheDocument();
  });

  it('says when the task runs again at its station', () => {
    render(
      <HoldMarker
        note={note({
          resumption: {
            next: 'continue',
            station: 'Implementation',
            summary: null,
          },
        })}
      />,
    );

    expect(
      screen.getByText(
        'Sam Rivera resumed the line. It runs again at Implementation.',
      ),
    ).toBeInTheDocument();
  });
});
