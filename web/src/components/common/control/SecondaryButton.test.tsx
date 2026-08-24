import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { SecondaryButton } from '@/components/common/control/SecondaryButton';

const renderButton = (props = {}) => {
  render(<SecondaryButton {...props}>Stop</SecondaryButton>);
  return screen.getByRole('button', { name: 'Stop' });
};

describe('SecondaryButton', () => {
  it('lights up under the pointer while it can be pressed', () => {
    const button = renderButton();

    expect(button.className).toContain('hover:bg-accent');
    expect(button.className).toContain('hover:text-foreground');
  });

  it('does not react to the pointer once disabled', () => {
    const button = renderButton({ disabled: true });

    expect(button).toBeDisabled();
    expect(button.className).not.toContain('hover:');
  });

  it('is a plain button unless told otherwise', () => {
    expect(renderButton()).toHaveAttribute('type', 'button');
  });

  it('takes an extra class without losing its own', () => {
    const button = renderButton({ className: 'ml-auto' });

    expect(button).toHaveClass('ml-auto');
    expect(button.className).toContain('border-border');
  });
});
