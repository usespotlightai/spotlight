import type { Meta, StoryObj } from '@storybook/react-vite';
import { choice, type PageArgs, pageStory } from '@/stories/application';

type InviteArgs = {
  readonly invite: string;
};

const meta = {
  title: 'Auth/Accept invite',
  ...pageStory<InviteArgs>({
    states: ['data', 'error'],
    at: ({ invite }) => `/invites/${invite}`,
    args: { invite: 'invite_sam' },
    argTypes: {
      invite: choice('Invite', {
        invite_sam: 'For you',
        invite_platform: 'For another account',
        invite_unknown: 'Not found',
        invite_accepted: 'Already accepted',
        invite_expired: 'Expired',
      }),
    },
  }),
} satisfies Meta<PageArgs & InviteArgs>;

export default meta;

export const AcceptInvite: StoryObj<typeof meta> = { name: 'Accept invite' };
