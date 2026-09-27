import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { RetireMemoryDialog } from '@/components/features/memory/RetireMemoryDialog';

describe('RetireMemoryDialog', () => {
  it('retires only with a reason', async () => {
    const onRetire = vi.fn();
    render(
      <RetireMemoryDialog
        open
        onOpenChange={() => undefined}
        pending={false}
        failed={false}
        onRetire={onRetire}
      />,
    );

    expect(screen.getByRole('button', { name: 'Retire' })).toBeDisabled();

    await userEvent.type(
      screen.getByRole('textbox', { name: 'Why it no longer holds' }),
      '  The worker was removed.  ',
    );
    await userEvent.click(screen.getByRole('button', { name: 'Retire' }));

    expect(onRetire).toHaveBeenCalledWith('The worker was removed.');
  });
});
