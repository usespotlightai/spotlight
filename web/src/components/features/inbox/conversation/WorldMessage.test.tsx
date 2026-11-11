import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { WorldMessage } from '@/components/features/inbox/conversation/WorldMessage';

describe('WorldMessage', () => {
  it('shows the integration it came from', () => {
    render(
      <WorldMessage
        body="The checks failed."
        attachments={[]}
        authors={[]}
        source="github"
        deferredTo={null}
      />,
    );

    expect(
      screen.getByRole('img', { name: 'From GitHub' }),
    ).toBeInTheDocument();
  });

  it('shows the member who wrote it beside the integration', () => {
    render(
      <WorldMessage
        body="Cap it at 500."
        attachments={[]}
        authors={[{ id: 'user_1', name: 'Anna', image: null }]}
        source="slack"
        deferredTo={null}
      />,
    );

    expect(
      screen.getByRole('img', { name: 'Anna wrote this in Slack' }),
    ).toBeInTheDocument();
  });

  it('says where the task moves when the run ends, outside the message', () => {
    render(
      <WorldMessage
        body="The checks failed."
        attachments={[]}
        authors={[]}
        source="github"
        deferredTo="Implementation"
      />,
    );

    expect(
      screen.getByText(
        'Arrived during a run. If the run does not pass the task on, the task moves to Implementation when the run ends.',
      ),
    ).toBeInTheDocument();
  });
});
