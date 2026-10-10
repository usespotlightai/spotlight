import type { Meta, StoryObj } from '@storybook/react-vite';
import { type PageArgs, pageStory } from '@/stories/application';

const meta = {
  title: 'Workspace/Default workspace',
  ...pageStory({ at: '/', scope: 'app' }),
} satisfies Meta<PageArgs>;

export default meta;

export const DefaultWorkspace: StoryObj<typeof meta> = {
  name: 'Default workspace',
};
