import type { Meta, StoryObj } from '@storybook/react-vite';
import { verifyEmailPath } from '@/lib/emails';
import { type PageArgs, pageStory } from '@/stories/application';

const meta = {
  title: 'Auth/Verify email',
  ...pageStory({
    states: ['data', 'empty'],
    at: verifyEmailPath('verification_sam'),
  }),
} satisfies Meta<PageArgs>;

export default meta;

export const VerifyEmail: StoryObj<typeof meta> = { name: 'Verify email' };
