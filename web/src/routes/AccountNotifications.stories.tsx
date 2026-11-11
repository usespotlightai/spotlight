import type { Meta, StoryObj } from '@storybook/react-vite';

import { notificationsPath } from '@/lib/notifications';
import { SLUG } from '@/mocks/world';
import { type PageArgs, pageStory } from '@/stories/application';

const meta = {
  title: 'Settings/Account/Notifications',
  ...pageStory({ at: notificationsPath(SLUG) }),
} satisfies Meta<PageArgs>;

export default meta;

export const Notifications: StoryObj<typeof meta> = { name: 'Notifications' };
