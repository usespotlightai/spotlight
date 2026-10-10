import type { Meta, StoryObj } from '@storybook/react-vite';
import { type PageArgs, pageStory, toggle } from '@/stories/application';

type LoginArgs = {
  readonly continuing: boolean;
};

const meta = {
  title: 'Auth/Log in',
  ...pageStory<LoginArgs>({
    at: '/login',
    args: { account: 'signed-out', continuing: false },
    argTypes: {
      continuing: toggle('Continue with GitHub'),
    },
    script: ({ continuing }) =>
      continuing
        ? async (screen, user) => {
            await user.click(
              await screen.findByRole('button', {
                name: 'Continue with GitHub',
              }),
            );
          }
        : undefined,
  }),
} satisfies Meta<PageArgs & LoginArgs>;

export default meta;

export const LogIn: StoryObj<typeof meta> = { name: 'Log in' };
