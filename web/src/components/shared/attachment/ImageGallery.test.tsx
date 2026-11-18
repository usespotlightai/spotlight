import { fireEvent, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useState } from 'react';
import { MemoryRouter, Route, Routes } from 'react-router';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { AttachmentTiles } from '@/components/shared/attachment/AttachmentTiles';
import { ImageThumbs } from '@/components/shared/chat-input/ImageThumbs';
import type { Attachment, ImageAttachment } from '@/lib/attachment';

const image = (id: string, name: string): Attachment => ({
  id,
  name,
  contentType: 'image/png',
  size: 10,
});

const pdf: Attachment = {
  id: 'att_pdf',
  name: 'doc.pdf',
  contentType: 'application/pdf',
  size: 10,
};

const tiles = (attachments: Attachment[]) =>
  render(
    <MemoryRouter initialEntries={['/w/acme/team/team_1/tasks/task_1']}>
      <Routes>
        <Route
          path="/w/:slug/team/:teamId/tasks/:taskId"
          element={<AttachmentTiles attachments={attachments} />}
        />
      </Routes>
    </MemoryRouter>,
  );

const three = [image('a', 'a.png'), image('b', 'b.png'), image('c', 'c.png')];

const view = (name: string) => screen.findByRole('img', { name });

const view_ = (name: string) => screen.getByRole('img', { name });

const peek = (side: string) =>
  document.querySelector<HTMLImageElement>(`[data-peek="${side}"]`);

const openAt = async (name: string) => {
  const user = userEvent.setup();
  await user.click(screen.getByRole('button', { name: `View ${name}` }));
  await view(name);
  await vi.waitFor(() =>
    expect(screen.getByRole('dialog')).toContainElement(
      document.activeElement as HTMLElement,
    ),
  );

  return user;
};

beforeEach(() => {
  vi.spyOn(HTMLImageElement.prototype, 'naturalWidth', 'get').mockReturnValue(
    400,
  );
  vi.spyOn(HTMLImageElement.prototype, 'naturalHeight', 'get').mockReturnValue(
    300,
  );
});

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

describe('ImageGallery', () => {
  it('moves between images with the arrow keys', async () => {
    tiles(three);
    const user = await openAt('a.png');

    await user.keyboard('{ArrowRight}');
    expect(await view('b.png')).toHaveAttribute(
      'src',
      '/api/workspaces/acme/attachments/b',
    );

    await user.keyboard('{ArrowLeft}');
    expect(await view('a.png')).toBeInTheDocument();
  });

  it('does not wrap before the first image', async () => {
    tiles(three);
    const user = await openAt('a.png');

    await user.keyboard('{ArrowLeft}');

    expect(view_('a.png')).toBeInTheDocument();
  });

  it('does not wrap after the last image', async () => {
    tiles(three);
    const user = await openAt('c.png');

    await user.keyboard('{ArrowRight}');

    expect(view_('c.png')).toBeInTheDocument();
  });

  it('skips attachments that are not images', async () => {
    tiles([image('a', 'a.png'), pdf, image('c', 'c.png')]);
    const user = await openAt('a.png');

    await user.keyboard('{ArrowRight}');

    expect(await view('c.png')).toBeInTheDocument();
  });

  it('ignores the arrow keys for a single image', async () => {
    tiles([image('a', 'a.png')]);
    const user = await openAt('a.png');

    await user.keyboard('{ArrowRight}');
    expect(view_('a.png')).toBeInTheDocument();
  });

  it('shows the position among several images', async () => {
    tiles(three);
    const user = await openAt('a.png');
    expect(screen.getByText('1 of 3')).toBeInTheDocument();

    await user.keyboard('{ArrowRight}');
    expect(await screen.findByText('2 of 3')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Next image' }));
    expect(await screen.findByText('3 of 3')).toBeInTheDocument();
  });

  it('fades the pager in when the view opens', async () => {
    const animate = vi.fn(() => ({ finished: Promise.resolve() }));
    Object.defineProperty(HTMLElement.prototype, 'animate', {
      configurable: true,
      value: animate,
    });
    tiles(three);
    await openAt('a.png');

    const pager = screen.getByText('1 of 3').parentElement;
    expect(animate.mock.contexts).toContain(pager);
    Reflect.deleteProperty(HTMLElement.prototype, 'animate');
  });

  it('disables the pager buttons at both ends', async () => {
    tiles(three);
    const user = await openAt('a.png');
    expect(
      screen.getByRole('button', { name: 'Previous image' }),
    ).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Next image' })).toBeEnabled();

    await user.click(screen.getByRole('button', { name: 'Next image' }));
    await user.click(await screen.findByRole('button', { name: 'Next image' }));
    await screen.findByText('3 of 3');
    expect(screen.getByRole('button', { name: 'Next image' })).toBeDisabled();
    expect(
      screen.getByRole('button', { name: 'Previous image' }),
    ).toBeEnabled();
  });

  it('stays open when a pager button is clicked', async () => {
    tiles(three);
    const user = await openAt('a.png');

    await user.click(screen.getByRole('button', { name: 'Next image' }));
    await screen.findByText('2 of 3');

    expect(screen.getByRole('dialog')).toBeInTheDocument();
  });

  it('shows no pager for a single image', async () => {
    tiles([image('a', 'a.png')]);
    await openAt('a.png');

    expect(screen.queryByRole('button', { name: 'Next image' })).toBeNull();
    expect(screen.queryByText('1 of 1')).toBeNull();
  });

  it('peeks at both neighbours of a middle image', async () => {
    tiles(three);
    const user = await openAt('a.png');
    expect(peek('previous')).toBeNull();
    expect(peek('next')).toHaveAttribute(
      'src',
      '/api/workspaces/acme/attachments/b',
    );

    await user.keyboard('{ArrowRight}');
    await view('b.png');
    expect(peek('previous')).toHaveAttribute(
      'src',
      '/api/workspaces/acme/attachments/a',
    );
    expect(peek('next')).toHaveAttribute(
      'src',
      '/api/workspaces/acme/attachments/c',
    );

    await user.keyboard('{ArrowRight}');
    await view('c.png');
    expect(peek('previous')).not.toBeNull();
    expect(peek('next')).toBeNull();
  });

  it('hides the peeks from assistive technology', async () => {
    tiles(three);
    await openAt('b.png');

    expect(peek('next')).toHaveAttribute('aria-hidden', 'true');
    expect(peek('next')).toHaveAttribute('alt', '');
  });

  it('moves to a neighbour when its peek is clicked', async () => {
    tiles(three);
    const user = await openAt('b.png');

    await user.click(peek('next') as HTMLElement);

    expect(await view('c.png')).toBeInTheDocument();
    expect(screen.getByText('3 of 3')).toBeInTheDocument();
  });

  it('shows no peeks for a single image', async () => {
    tiles([image('a', 'a.png')]);
    await openAt('a.png');

    expect(peek('previous')).toBeNull();
    expect(peek('next')).toBeNull();
  });

  it('keeps room for peeks beside a wide image', async () => {
    vi.spyOn(HTMLImageElement.prototype, 'naturalWidth', 'get').mockReturnValue(
      640,
    );
    vi.spyOn(
      HTMLImageElement.prototype,
      'naturalHeight',
      'get',
    ).mockReturnValue(400);
    vi.stubGlobal('innerWidth', 1280);
    vi.stubGlobal('innerHeight', 1600);
    tiles(three);
    await openAt('b.png');

    expect(peek('previous')).not.toBeNull();
    expect(peek('next')).not.toBeNull();
  });

  it('gives focus back to the last viewed tile on close', async () => {
    tiles(three);
    const user = await openAt('a.png');

    await user.keyboard('{ArrowRight}{ArrowRight}');
    await view('c.png');
    await user.click(screen.getByRole('button', { name: 'Close' }));

    await vi.waitFor(() =>
      expect(screen.getByRole('button', { name: 'View c.png' })).toHaveFocus(),
    );
  });
});

const thumb = (key: string): ImageAttachment => ({
  key,
  name: `${key}.png`,
  size: 10,
  state: 'ready',
  id: key,
  imageSource: { url: `/${key}.png` },
});

function Composer({ initial }: { initial: ImageAttachment[] }) {
  const [images, setImages] = useState(initial);

  return (
    <ImageThumbs
      images={images}
      onRemove={(key) => setImages((was) => was.filter((e) => e.key !== key))}
    />
  );
}

describe('ImageThumbs gallery', () => {
  it('moves between composer images with the arrow keys', async () => {
    render(<Composer initial={[thumb('a'), thumb('b')]} />);
    const user = await openAt('a.png');

    await user.keyboard('{ArrowRight}');

    expect(await view('b.png')).toHaveAttribute('src', '/b.png');
  });

  it('shows the pager for several composer images', async () => {
    render(<Composer initial={[thumb('a'), thumb('b')]} />);
    await openAt('a.png');

    expect(screen.getByText('1 of 2')).toBeInTheDocument();
  });

  it('skips an image that does not load', async () => {
    render(<Composer initial={[thumb('a'), thumb('b'), thumb('c')]} />);
    fireEvent.error(
      screen
        .getByRole('button', { name: 'View b.png' })
        .querySelector('img') as HTMLImageElement,
    );
    const user = await openAt('a.png');

    await user.keyboard('{ArrowRight}');

    expect(await view('c.png')).toBeInTheDocument();
  });

  it('closes when the open image is removed', async () => {
    render(<Composer initial={[thumb('a'), thumb('b')]} />);
    await openAt('a.png');

    const remove = screen.getByRole('button', {
      name: 'Remove a.png',
      hidden: true,
    });
    fireEvent.click(remove);

    await vi.waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
  });
});
