import type { Meta, StoryObj } from '@storybook/react-vite';
import { addHostPath } from '@/lib/runner';
import { SLUG } from '@/mocks/world';
import { type PageArgs, pageStory, toggle } from '@/stories/application';

type AddHostArgs = {
  readonly created: boolean;
};

const meta = {
  title: 'Settings/Workspace/Runners/Add a host',
  ...pageStory<AddHostArgs>({
    at: addHostPath(SLUG),
    args: { created: false },
    argTypes: { created: toggle('Pool created') },
    script: ({ created }) =>
      created
        ? async (screen, user) => {
            await user.click(
              await screen.findByRole('button', { name: 'Create pool' }),
            );
          }
        : undefined,
  }),
} satisfies Meta<PageArgs & AddHostArgs>;

export default meta;

export const AddAHost: StoryObj<typeof meta> = { name: 'Add a host' };
