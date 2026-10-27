import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { PersonMessage } from '@/components/features/inbox/conversation/PersonMessage';

describe('PersonMessage', () => {
  it('shows the avatars of everyone who wrote the message', () => {
    render(
      <PersonMessage
        body="Cap it at 500."
        attachments={[]}
        authors={[
          { id: 'user_1', name: 'Anna', image: null },
          { id: 'user_2', name: 'Ben', image: null },
        ]}
      />,
    );

    expect(
      screen.getByRole('img', { name: 'Anna and Ben wrote this' }),
    ).toBeInTheDocument();
  });

  it('shows no avatars where nobody is named', () => {
    render(
      <PersonMessage body="Cap it at 500." attachments={[]} authors={[]} />,
    );

    expect(screen.queryByRole('img')).not.toBeInTheDocument();
  });
});
