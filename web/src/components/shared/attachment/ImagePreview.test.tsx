import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { ImagePreview } from '@/components/shared/attachment/ImagePreview';

const shot = () => new File(['png'], 'shot.png', { type: 'image/png' });

afterEach(() => {
  vi.restoreAllMocks();
});

describe('ImagePreview', () => {
  it('draws the image while it is shown, and lets it go once it is not', () => {
    vi.spyOn(URL, 'createObjectURL').mockReturnValue('blob:preview');
    const revoked = vi.spyOn(URL, 'revokeObjectURL');

    const { unmount } = render(<ImagePreview image={shot()} name="shot.png" />);

    expect(
      screen
        .getByRole('button', { name: 'View shot.png' })
        .querySelector('img'),
    ).toHaveAttribute('src', 'blob:preview');

    unmount();

    expect(revoked).toHaveBeenCalledWith('blob:preview');
  });

  it('shows the image large when clicked, and closes on Escape', async () => {
    vi.spyOn(URL, 'createObjectURL').mockReturnValue('blob:preview');
    vi.spyOn(HTMLImageElement.prototype, 'naturalWidth', 'get').mockReturnValue(
      400,
    );
    vi.spyOn(
      HTMLImageElement.prototype,
      'naturalHeight',
      'get',
    ).mockReturnValue(300);
    const user = userEvent.setup();

    render(<ImagePreview image={shot()} name="shot.png" />);

    await user.click(screen.getByRole('button', { name: 'View shot.png' }));

    const view = await screen.findByRole('img', { name: 'shot.png' });
    expect(view).toHaveAttribute('width', '400');
    expect(view).toHaveAttribute('height', '300');

    await user.keyboard('{Escape}');

    await vi.waitFor(() =>
      expect(screen.queryByRole('img', { name: 'shot.png' })).toBeNull(),
    );
  });
});
