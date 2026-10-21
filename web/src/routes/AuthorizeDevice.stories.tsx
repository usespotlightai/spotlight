import type { Meta, StoryObj } from '@storybook/react-vite';
import { devicePath } from '@/lib/device';
import { choice, type PageArgs, pageStory } from '@/stories/application';

type DeviceArgs = {
  readonly code: string;
};

const meta = {
  title: 'Auth/Authorize device',
  ...pageStory<DeviceArgs>({
    states: ['data', 'error'],
    at: ({ code }) => (code === '' ? '/device' : devicePath(code)),
    args: { code: 'WDJBMJHT' },
    argTypes: {
      code: choice('Code', {
        WDJBMJHT: 'Waiting for approval',
        QPRNKZ4V: 'Approved',
        HX7MCL2R: 'Denied',
        ZZZZZZZZ: 'Expired or unknown',
        '': 'Not entered',
      }),
    },
  }),
} satisfies Meta<PageArgs & DeviceArgs>;

export default meta;

export const AuthorizeDevice: StoryObj<typeof meta> = {
  name: 'Authorize device',
};
