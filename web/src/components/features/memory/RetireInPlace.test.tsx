import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { RetireInPlace } from '@/components/features/memory/RetireInPlace';

const retire = { mutate: vi.fn(), isPending: false, isError: false };

vi.mock('@/hooks/api/useRetireMemory', () => ({
  useRetireMemory: () => retire,
}));
vi.mock('@/hooks/api/useSession', () => ({
  useSession: () => ({ data: { user: { name: 'Ada Lovelace', image: null } } }),
}));

const onCancel = vi.fn();

const showing = () =>
  render(
    <RetireInPlace teamId="team_1" memoryId="memory_1" onCancel={onCancel} />,
  );

beforeEach(() => {
  retire.mutate.mockReset();
  retire.isError = false;
  onCancel.mockReset();
});

describe('RetireInPlace', () => {
  it('retires only with a reason, trimmed', async () => {
    showing();
    const send = screen.getByRole('button', { name: 'Retire' });

    expect(send).toBeDisabled();
    await userEvent.type(
      screen.getByRole('textbox', { name: 'Why it no longer holds' }),
      '   ',
    );
    expect(send).toBeDisabled();

    await userEvent.type(
      screen.getByRole('textbox', { name: 'Why it no longer holds' }),
      'It was fixed.  ',
    );
    await userEvent.click(send);

    expect(retire.mutate).toHaveBeenCalledWith({
      teamId: 'team_1',
      memoryId: 'memory_1',
      reason: 'It was fixed.',
    });
  });

  it('starts ready to type, as the person speaking', () => {
    showing();

    expect(
      screen.getByRole('textbox', { name: 'Why it no longer holds' }),
    ).toHaveFocus();
    expect(screen.getByText('Ada Lovelace')).toBeVisible();
    expect(screen.getByText('retiring this')).toBeVisible();
  });

  it('retires from the keyboard, and backs out with Escape', async () => {
    showing();

    await userEvent.type(
      screen.getByRole('textbox', { name: 'Why it no longer holds' }),
      'It was fixed.{Control>}{Enter}{/Control}',
    );
    expect(retire.mutate).toHaveBeenCalledTimes(1);

    await userEvent.keyboard('{Escape}');
    expect(onCancel).toHaveBeenCalled();
  });

  it('says so when it could not be retired', () => {
    retire.isError = true;

    showing();

    expect(screen.getByRole('alert')).toHaveTextContent(
      'It could not be retired. Try again.',
    );
  });
});
