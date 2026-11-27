import { act, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';

function Toolbar() {
  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger iconOnly aria-label="Copy">
          C
        </TooltipTrigger>
        <TooltipContent>Copy the command</TooltipContent>
      </Tooltip>
      <Tooltip>
        <TooltipTrigger iconOnly aria-label="Delete">
          D
        </TooltipTrigger>
        <TooltipContent>Delete the host</TooltipContent>
      </Tooltip>
      <Tooltip>
        <TooltipTrigger>Inbox</TooltipTrigger>
        <TooltipContent>Go to Inbox</TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}

const elapse = (ms: number) =>
  act(async () => {
    await vi.advanceTimersByTimeAsync(ms);
  });

describe('Tooltip', () => {
  beforeEach(() => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  const user = () =>
    userEvent.setup({ advanceTimers: vi.advanceTimersByTime });

  it('names an icon soon after the pointer rests on it', async () => {
    render(<Toolbar />);

    await user().hover(screen.getByRole('button', { name: 'Copy' }));
    await elapse(100);
    expect(screen.queryByText('Copy the command')).not.toBeInTheDocument();

    await elapse(100);
    expect(screen.getByText('Copy the command')).toBeInTheDocument();
  });

  it('waits longer before adding detail to a trigger that shows its own text', async () => {
    render(<Toolbar />);

    await user().hover(screen.getByRole('button', { name: 'Inbox' }));
    await elapse(500);
    expect(screen.queryByText('Go to Inbox')).not.toBeInTheDocument();

    await elapse(300);
    expect(screen.getByText('Go to Inbox')).toBeInTheDocument();
  });

  it('opens the next tooltip at once while one is open', async () => {
    render(<Toolbar />);
    const pointer = user();

    await pointer.hover(screen.getByRole('button', { name: 'Copy' }));
    await elapse(200);
    expect(screen.getByText('Copy the command')).toBeInTheDocument();

    await pointer.hover(screen.getByRole('button', { name: 'Delete' }));
    await elapse(0);
    expect(screen.getByText('Delete the host')).toBeInTheDocument();
  });
});
