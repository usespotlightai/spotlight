import type { Meta, StoryObj } from '@storybook/react-vite';
import { within } from 'storybook/test';

import { ImageGallery } from '@/components/shared/attachment/ImageGallery';
import { ZoomableImage } from '@/components/shared/attachment/ZoomableImage';

const picture = (fill: string, label: string) =>
  `data:image/svg+xml;utf8,${encodeURIComponent(
    `<svg xmlns="http://www.w3.org/2000/svg" width="640" height="400"><rect width="640" height="400" fill="${fill}"/><text x="320" y="210" font-size="48" text-anchor="middle" fill="white">${label}</text></svg>`,
  )}`;

const images = [
  { name: 'login.png', src: picture('#2563eb', 'Login') },
  { name: 'settings.png', src: picture('#16a34a', 'Settings') },
  { name: 'billing.png', src: picture('#dc2626', 'Billing') },
];

const gallery = (shown: typeof images) => (
  <ImageGallery>
    <ul className="flex gap-3 p-6">
      {shown.map((each) => (
        <li key={each.name} className="size-28 overflow-hidden rounded-lg">
          <ZoomableImage
            src={each.src}
            name={each.name}
            className="size-full object-cover"
          />
        </li>
      ))}
    </ul>
  </ImageGallery>
);

const meta = {
  title: 'Shared/ImageGallery',
  render: () => gallery(images),
} satisfies Meta;

export default meta;

export const Open: StoryObj<typeof meta> = {
  play: async ({ canvas, userEvent }) => {
    await userEvent.click(
      canvas.getByRole('button', { name: 'View settings.png' }),
    );
    await userEvent.click(
      await within(document.body).findByRole('button', {
        name: 'Next image',
      }),
    );
  },
};

export const SingleImage: StoryObj<typeof meta> = {
  render: () => gallery(images.slice(0, 1)),
  play: async ({ canvas, userEvent }) => {
    await userEvent.click(
      canvas.getByRole('button', { name: 'View login.png' }),
    );
  },
};
