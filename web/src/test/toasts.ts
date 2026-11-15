import { screen } from '@testing-library/react';

export const findToast = async (text: string): Promise<HTMLElement | null> =>
  (await screen.findByText(text, undefined, { timeout: 5000 })).closest(
    '[data-slot="toast"]',
  );
