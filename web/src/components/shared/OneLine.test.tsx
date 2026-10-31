import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { OneLine } from '@/components/shared/OneLine';

const TEXT = 'Generating database migrations, never writing them by hand.';

const measuring = (scrollWidth: number, clientWidth: number) => {
  vi.spyOn(HTMLElement.prototype, 'scrollWidth', 'get').mockReturnValue(
    scrollWidth,
  );
  vi.spyOn(HTMLElement.prototype, 'clientWidth', 'get').mockReturnValue(
    clientWidth,
  );
};

const hovering = async () => {
  const user = userEvent.setup();
  await user.hover(
    screen.getByText(TEXT, { selector: '[data-slot=one-line]' }),
  );
};

describe('OneLine', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('shows the whole text in a tooltip when the line cuts it', async () => {
    measuring(400, 200);
    render(<OneLine text={TEXT} />);

    await hovering();

    expect(
      await screen.findByText(TEXT, {
        selector: '[data-slot=tooltip-content]',
      }),
    ).toHaveTextContent(TEXT);
  });

  it('shows no tooltip when the text fits', async () => {
    measuring(200, 200);
    render(<OneLine text={TEXT} />);

    await hovering();
    await new Promise((resolve) => setTimeout(resolve, 800));

    expect(
      document.querySelector('[data-slot=tooltip-content]'),
    ).not.toBeInTheDocument();
  });

  it('measures again when the text changes', async () => {
    const scrollWidth = vi
      .spyOn(HTMLElement.prototype, 'scrollWidth', 'get')
      .mockReturnValue(200);
    vi.spyOn(HTMLElement.prototype, 'clientWidth', 'get').mockReturnValue(200);
    const { rerender } = render(<OneLine text="Short" />);

    scrollWidth.mockReturnValue(400);
    rerender(<OneLine text={TEXT} />);
    await hovering();

    expect(
      await screen.findByText(TEXT, {
        selector: '[data-slot=tooltip-content]',
      }),
    ).toHaveTextContent(TEXT);
  });
});
