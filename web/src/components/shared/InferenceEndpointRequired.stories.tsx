import type { Meta, StoryObj } from '@storybook/react-vite';

import { InferenceEndpointRequired } from '@/components/shared/InferenceEndpointRequired';
import { SLUG } from '@/mocks/world';
import { inWorkspace } from '@/stories/inference';

const meta = {
  title: 'Settings/Workspace/Inference required',
  component: InferenceEndpointRequired,
  args: { slug: SLUG, children: 'The judge is off.' },
  decorators: [inWorkspace('unset')],
} satisfies Meta<typeof InferenceEndpointRequired>;

export default meta;

export const Default: StoryObj<typeof meta> = {};
