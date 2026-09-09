import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useState } from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { NewTaskDialog } from '@/components/features/board/task/NewTaskDialog';
import type { NewTask } from '@/lib/task';

const created = vi.fn();

function Harness() {
  const [open, setOpen] = useState(true);

  return (
    <NewTaskDialog
      open={open}
      onOpenChange={setOpen}
      lineName="Default"
      stationName="Triage"
      onCreate={(task: NewTask) => created(task)}
    />
  );
}

const renderDialog = () =>
  render(
    <QueryClientProvider client={new QueryClient()}>
      <Harness />
    </QueryClientProvider>,
  );

const title = () => screen.getByRole('textbox', { name: 'Task title' });
const create = () => screen.getByRole('button', { name: 'Create task' });

beforeEach(() => {
  localStorage.clear();
  created.mockClear();
});

describe('NewTaskDialog', () => {
  it('says which line and station the task is going to', () => {
    renderDialog();

    const heading = screen.getByRole('heading');

    expect(heading).toHaveTextContent('Default');
    expect(heading).toHaveTextContent('Triage');
    expect(heading).toHaveTextContent('New task');
  });

  it('refuses to create a task with no title', () => {
    renderDialog();

    expect(create()).toBeDisabled();
  });

  it('hands back the title that was typed', async () => {
    const user = userEvent.setup();
    renderDialog();

    await user.type(title(), 'Fix the queue');
    await user.click(create());

    expect(created).toHaveBeenCalledWith({
      title: 'Fix the queue',
      description: '',
    });
  });

  it('closes once the task is created', async () => {
    const user = userEvent.setup();
    renderDialog();

    await user.type(title(), 'Fix the queue');
    await user.click(create());

    await waitFor(() =>
      expect(
        screen.queryByRole('textbox', { name: 'Task title' }),
      ).not.toBeInTheDocument(),
    );
  });

  it('stays open and empties itself when asked to create more', async () => {
    const user = userEvent.setup();
    renderDialog();

    await user.click(screen.getByRole('switch', { name: /Create more/ }));
    await user.type(title(), 'Fix the queue');
    await user.click(create());

    expect(created).toHaveBeenCalledTimes(1);
    expect(title()).toHaveValue('');
    expect(create()).toBeDisabled();
  });
});
