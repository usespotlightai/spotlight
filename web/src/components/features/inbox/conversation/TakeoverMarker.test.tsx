import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { TakeoverMarker } from '@/components/features/inbox/conversation/TakeoverMarker';
import type { Note } from '@/lib/inbox';

const note = (over: Partial<Note>): Note => ({
  position: 3,
  kind: 'message',
  form: 'handed-back',
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
  handBack: null,
  ...over,
});

describe('TakeoverMarker', () => {
  it('says who took over the task', () => {
    render(<TakeoverMarker note={note({ form: 'took-over' })} />);

    expect(
      screen.getByText('Sam Rivera took over the task.'),
    ).toBeInTheDocument();
  });

  it('says where the task went after the hand back, and shows the summary', () => {
    render(
      <TakeoverMarker
        note={note({
          handBack: {
            next: 'move-on',
            station: 'Review',
            summary: 'I bounded the queue.',
          },
        })}
      />,
    );

    expect(
      screen.getByText('Sam Rivera handed the task back. It moved to Review.'),
    ).toBeInTheDocument();
    expect(screen.getByText('I bounded the queue.')).toBeInTheDocument();
  });

  it('says when the task runs again at its station', () => {
    render(
      <TakeoverMarker
        note={note({
          handBack: {
            next: 'continue',
            station: 'Implementation',
            summary: null,
          },
        })}
      />,
    );

    expect(
      screen.getByText(
        'Sam Rivera handed the task back. It runs again at Implementation.',
      ),
    ).toBeInTheDocument();
  });
});
