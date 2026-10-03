import { render, screen } from '@testing-library/react';
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

    const { unmount } = render(<ImagePreview image={shot()} alt="shot.png" />);

    expect(screen.getByRole('img', { name: 'shot.png' })).toHaveAttribute(
      'src',
      'blob:preview',
    );

    unmount();

    expect(revoked).toHaveBeenCalledWith('blob:preview');
  });
});
