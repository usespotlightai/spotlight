import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { ApprovalCard } from '@/components/features/inbox/conversation/approval/ApprovalCard';
import type { Approval } from '@/lib/approval';

const COMMENT: Approval = {
  kind: 'tool-call',
  name: 'linear.comment',
  because: 'It posts publicly, under the team’s name.',
  inputs: [
    { name: 'body', value: 'Fixed.' },
    { name: 'issue', value: 'ENG-12' },
  ],
  status: 'asked',
  edited: null,
  intent: 'post the drain summary on the issue, publicly under the team’s name',
  askedOf: null,
};

const EXECUTE: Approval = {
  kind: 'harness-permission',
  name: 'claude-code execute',
  because: 'The harness asked before doing it.',
  inputs: [{ name: 'title', value: 'kubectl logs deploy/api --since=1h' }],
  status: 'asked',
  edited: null,
  intent: null,
  askedOf: null,
};

const showing = (approval: Approval, onDecide = vi.fn()) => {
  render(
    <ApprovalCard approval={approval} pending={false} onDecide={onDecide} />,
  );

  return onDecide;
};

describe('ApprovalCard', () => {
  it('says what the agent would like to do, then shows the action itself', () => {
    showing(COMMENT);

    expect(
      screen.getByText(
        'Spotlight would like to post the drain summary on the issue, publicly under the team’s name.',
      ),
    ).toBeInTheDocument();
    expect(screen.getByText('Fixed.')).toBeInTheDocument();
    expect(screen.getByText('ENG-12')).toBeInTheDocument();
    expect(screen.queryByText(COMMENT.because)).not.toBeInTheDocument();
    expect(
      screen.getByRole('heading', { name: 'Waiting for your approval' }),
    ).toBeInTheDocument();
  });

  it('names the tool and why it asks, where the agent gave no intent', () => {
    showing(EXECUTE);

    expect(
      screen.getByText(
        'Spotlight would like to use claude-code execute. The harness asked before doing it.',
      ),
    ).toBeInTheDocument();
  });

  it('approves it unchanged', async () => {
    const onDecide = showing(COMMENT);

    await userEvent.click(
      screen.getByRole('button', { name: 'Approve linear.comment' }),
    );

    expect(onDecide).toHaveBeenCalledWith({ approve: true, body: '' });
  });

  it('lets only the person it was asked of approve it, and anyone dismiss it', async () => {
    const onDecide = vi.fn();
    render(
      <ApprovalCard
        approval={{ ...COMMENT, askedOf: { id: 'user_alice', name: 'Alice' } }}
        viewerId="user_bob"
        pending={false}
        onDecide={onDecide}
      />,
    );

    const approve = screen.getByRole('button', {
      name: 'Approve linear.comment',
    });
    expect(approve).toBeDisabled();
    expect(approve).toHaveAccessibleDescription('Only Alice can approve this');
    expect(screen.getByText('Only Alice can approve this')).toHaveClass(
      'sr-only',
    );
    expect(
      screen.queryByRole('button', { name: 'Edit linear.comment' }),
    ).not.toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: 'Dismiss linear.comment' }),
    ).toBeEnabled();
  });

  it('lets the person it was asked of approve it', async () => {
    const onDecide = vi.fn();
    render(
      <ApprovalCard
        approval={{ ...COMMENT, askedOf: { id: 'user_alice', name: 'Alice' } }}
        viewerId="user_alice"
        pending={false}
        onDecide={onDecide}
      />,
    );

    await userEvent.click(
      screen.getByRole('button', { name: 'Approve linear.comment' }),
    );

    expect(onDecide).toHaveBeenCalledWith({ approve: true, body: '' });
    expect(screen.queryByText(/Only .* can approve this/)).toBeNull();
  });

  it('approves it with what the person changed', async () => {
    const onDecide = showing(COMMENT);

    await userEvent.click(
      screen.getByRole('button', { name: 'Edit linear.comment' }),
    );
    const body = screen.getByRole('textbox', { name: 'body' });
    await userEvent.clear(body);
    await userEvent.type(body, 'Fixed in #41.');
    await userEvent.click(
      screen.getByRole('button', { name: 'Approve linear.comment' }),
    );

    expect(onDecide).toHaveBeenCalledWith({
      approve: true,
      body: '',
      inputs: [
        { name: 'body', value: 'Fixed in #41.' },
        { name: 'issue', value: 'ENG-12' },
      ],
    });
  });

  it('approves it unchanged where the edits changed nothing', async () => {
    const onDecide = showing(COMMENT);

    await userEvent.click(
      screen.getByRole('button', { name: 'Edit linear.comment' }),
    );
    await userEvent.click(
      screen.getByRole('button', { name: 'Approve linear.comment' }),
    );

    expect(onDecide).toHaveBeenCalledWith({
      approve: true,
      body: '',
      inputs: undefined,
    });
  });

  it('approves nothing while an input is left blank', async () => {
    showing(COMMENT);

    await userEvent.click(
      screen.getByRole('button', { name: 'Edit linear.comment' }),
    );
    await userEvent.clear(screen.getByRole('textbox', { name: 'body' }));

    expect(
      screen.getByRole('button', { name: 'Approve linear.comment' }),
    ).toBeDisabled();
  });

  it('forgets the reason on cancel, so dismissing again starts afresh', async () => {
    showing(COMMENT);

    await userEvent.click(
      screen.getByRole('button', { name: 'Dismiss linear.comment' }),
    );
    await userEvent.type(
      screen.getByRole('textbox', { name: 'Why dismiss linear.comment' }),
      'Not yet.',
    );
    await userEvent.click(screen.getByRole('button', { name: 'Cancel' }));
    await userEvent.click(
      screen.getByRole('button', { name: 'Dismiss linear.comment' }),
    );

    expect(
      screen.getByRole('textbox', { name: 'Why dismiss linear.comment' }),
    ).toHaveValue('');
  });

  it('puts the edits away on cancel', async () => {
    showing(COMMENT);

    await userEvent.click(
      screen.getByRole('button', { name: 'Edit linear.comment' }),
    );
    await userEvent.type(screen.getByRole('textbox', { name: 'body' }), '!');
    await userEvent.click(screen.getByRole('button', { name: 'Cancel' }));

    expect(screen.getByText('Fixed.')).toBeInTheDocument();
    expect(screen.queryByRole('textbox')).not.toBeInTheDocument();
  });

  it('dismisses it with the reason the person gives the agent', async () => {
    const onDecide = showing(COMMENT);

    await userEvent.click(
      screen.getByRole('button', { name: 'Dismiss linear.comment' }),
    );
    await userEvent.type(
      screen.getByRole('textbox', { name: 'Why dismiss linear.comment' }),
      'Not before the release.',
    );
    await userEvent.click(
      screen.getByRole('button', { name: 'Dismiss linear.comment' }),
    );

    expect(onDecide).toHaveBeenCalledWith({
      approve: false,
      body: 'Not before the release.',
    });
  });

  it('copies the action to run it elsewhere', async () => {
    const user = userEvent.setup();
    showing(EXECUTE);

    await user.click(
      screen.getByRole('button', { name: 'Copy claude-code execute' }),
    );

    await expect(navigator.clipboard.readText()).resolves.toBe(
      'kubectl logs deploy/api --since=1h',
    );
    expect(screen.getByRole('button', { name: 'Copied' })).toBeInTheDocument();
  });

  it('offers no edit for what a harness asked, which takes only a yes or a no', () => {
    showing(EXECUTE);

    expect(
      screen.queryByRole('button', { name: 'Edit claude-code execute' }),
    ).not.toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: 'Approve claude-code execute' }),
    ).toBeInTheDocument();
  });

  it('says it was approved with the person’s changes, and shows what runs', () => {
    showing({
      ...COMMENT,
      status: 'granted',
      edited: [
        { name: 'body', value: 'Fixed in #41.' },
        { name: 'issue', value: 'ENG-12' },
      ],
    });

    expect(
      screen.getByRole('heading', { name: 'Request approved with changes' }),
    ).toBeInTheDocument();
    expect(screen.getByText('Fixed in #41.')).toBeInTheDocument();
    expect(screen.getByText('(modified)')).toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: 'Approve linear.comment' }),
    ).toBeDisabled();
    expect(
      screen.getByRole('button', { name: 'Dismiss linear.comment' }),
    ).toBeDisabled();
  });

  it('titles it as approved or dismissed', () => {
    const { rerender } = render(
      <ApprovalCard
        approval={{ ...COMMENT, status: 'granted' }}
        pending={false}
      />,
    );

    expect(
      screen.getByRole('heading', { name: 'Request approved' }),
    ).toBeInTheDocument();
    expect(
      screen.queryByRole('heading', { name: 'Waiting for your approval' }),
    ).not.toBeInTheDocument();

    rerender(
      <ApprovalCard
        approval={{ ...COMMENT, status: 'refused' }}
        pending={false}
      />,
    );

    expect(
      screen.getByRole('heading', { name: 'Request dismissed' }),
    ).toBeInTheDocument();
  });
});
