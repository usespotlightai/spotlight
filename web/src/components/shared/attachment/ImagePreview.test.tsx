import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ImagePreview } from '@/components/shared/attachment/ImagePreview';
import { Dialog, DialogContent, DialogTitle } from '@/components/ui/dialog';

const shot = () => new File(['png'], 'shot.png', { type: 'image/png' });

const sized = (width: number, height: number) => {
  vi.spyOn(HTMLImageElement.prototype, 'naturalWidth', 'get').mockReturnValue(
    width,
  );
  vi.spyOn(HTMLImageElement.prototype, 'naturalHeight', 'get').mockReturnValue(
    height,
  );
};

const opened = async () => {
  const user = userEvent.setup();
  await user.click(screen.getByRole('button', { name: 'View shot.png' }));
  const view = await screen.findByRole('img', { name: 'shot.png' });

  return { user, view };
};

const closed = () =>
  vi.waitFor(() =>
    expect(screen.queryByRole('img', { name: 'shot.png' })).toBeNull(),
  );

beforeEach(() => {
  vi.spyOn(URL, 'createObjectURL').mockReturnValue('blob:preview');
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe('ImagePreview', () => {
  it('draws the image while it is shown, and lets it go once it is not', () => {
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
    sized(400, 300);
    render(<ImagePreview image={shot()} name="shot.png" />);

    const { user, view } = await opened();
    expect(view).toHaveAttribute('width', '400');
    expect(view).toHaveAttribute('height', '300');

    await user.keyboard('{Escape}');

    await closed();
  });

  it('closes on Close and gives focus back to the thumbnail', async () => {
    sized(400, 300);
    render(<ImagePreview image={shot()} name="shot.png" />);

    const { user } = await opened();
    await user.click(screen.getByRole('button', { name: 'Close' }));

    await closed();
    await vi.waitFor(() =>
      expect(
        screen.getByRole('button', { name: 'View shot.png' }),
      ).toHaveFocus(),
    );
  });

  it('closes on a click anywhere in the view', async () => {
    sized(400, 300);
    render(<ImagePreview image={shot()} name="shot.png" />);

    const { user, view } = await opened();
    await user.click(view);

    await closed();
  });

  it('fills the room it has when the image has no size of its own', async () => {
    sized(0, 0);
    render(<ImagePreview image={shot()} name="shot.png" />);

    const { view } = await opened();

    expect(view).toHaveAttribute('width', String(window.innerWidth - 128));
    expect(view).toHaveAttribute('height', String(window.innerHeight - 64));
  });

  it('keeps its clicks from what it sits in', async () => {
    sized(400, 300);
    const outer = vi.fn();
    render(
      // biome-ignore lint/a11y/noStaticElementInteractions: a stand-in for a clickable parent
      // biome-ignore lint/a11y/useKeyWithClickEvents: a stand-in for a clickable parent
      <div onClick={outer}>
        <ImagePreview image={shot()} name="shot.png" />
      </div>,
    );

    const { user, view } = await opened();
    await user.click(view);
    await closed();

    expect(outer).not.toHaveBeenCalled();
  });

  it('closes on Escape without closing the dialog it opened from', async () => {
    sized(400, 300);
    render(
      <Dialog open>
        <DialogContent>
          <DialogTitle>New task</DialogTitle>
          <ImagePreview image={shot()} name="shot.png" />
        </DialogContent>
      </Dialog>,
    );

    const { user } = await opened();
    await user.keyboard('{Escape}');

    await closed();
    expect(
      screen.getByRole('dialog', { name: 'New task' }),
    ).toBeInTheDocument();
  });
});
