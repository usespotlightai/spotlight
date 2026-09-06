import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { Composer } from '@/components/features/inbox/conversation/Composer';

const composer = (over: Partial<Parameters<typeof Composer>[0]> = {}) =>
  render(
    <Composer
      label="Say something to Triage"
      placeholder="Say something…"
      pending={false}
      onSend={vi.fn()}
      {...over}
    />,
  );

describe('Composer', () => {
  it('offers to send, not to stop, when nothing is running', () => {
    composer({ running: false, onStop: vi.fn() });

    expect(screen.getByRole('button', { name: 'Send' })).toBeInTheDocument();
    expect(
      screen.queryByRole('button', { name: 'Stop' }),
    ).not.toBeInTheDocument();
  });

  it('offers to stop the agent while it works and the box is empty', () => {
    composer({ running: true, onStop: vi.fn() });

    expect(screen.getByRole('button', { name: 'Stop' })).toBeInTheDocument();
    expect(
      screen.queryByRole('button', { name: 'Send' }),
    ).not.toBeInTheDocument();
  });

  it('becomes a send the moment something is typed, and a stop once cleared', async () => {
    const person = userEvent.setup();
    composer({ running: true, onStop: vi.fn() });

    const box = screen.getByRole('textbox', {
      name: 'Say something to Triage',
    });

    await person.type(box, 'wait, do this instead');
    expect(screen.getByRole('button', { name: 'Send' })).toBeInTheDocument();
    expect(
      screen.queryByRole('button', { name: 'Stop' }),
    ).not.toBeInTheDocument();

    await person.clear(box);
    expect(screen.getByRole('button', { name: 'Stop' })).toBeInTheDocument();
  });

  it('stops the agent when the stop button is pressed', async () => {
    const person = userEvent.setup();
    const onStop = vi.fn();
    composer({ running: true, onStop });

    await person.click(screen.getByRole('button', { name: 'Stop' }));

    expect(onStop).toHaveBeenCalledTimes(1);
  });

  it('never offers to stop when it was given no way to', () => {
    composer({ running: true });

    expect(
      screen.queryByRole('button', { name: 'Stop' }),
    ).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Send' })).toBeInTheDocument();
  });
});
