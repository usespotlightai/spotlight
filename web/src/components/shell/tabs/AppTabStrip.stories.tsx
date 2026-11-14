import type { Meta, StoryObj } from '@storybook/react-vite';

import { DashboardLayout } from '@/components/shell/layout/DashboardLayout';
import { AppTabStrip } from '@/components/shell/tabs/AppTabStrip';

const TABS = [
  {
    id: 'a',
    path: '/w/acme/inbox',
    title: 'Inbox',
    back: [{ path: '/w/acme/team/team_1/runs' }],
    forward: [],
  },
  {
    id: 'b',
    path: '/w/acme/team/team_1/runs',
    title: 'Runs',
    back: [],
    forward: [],
  },
];

const meta = {
  title: 'Shell/AppTabStrip',
  component: AppTabStrip,
  args: {
    tabs: TABS,
    activeId: 'a',
    canGoBack: true,
    canGoForward: false,
    onSelect: () => {},
    onClose: () => {},
    onOpen: () => {},
    onBack: () => {},
    onForward: () => {},
  },
  decorators: [
    (Story) => {
      Object.assign(window, { spotlightDesktop: { platform: 'darwin' } });

      return <Story />;
    },
  ],
} satisfies Meta<typeof AppTabStrip>;

export default meta;

type Story = StoryObj<typeof meta>;

export const InDesktopApp: Story = {};

export const BesideTheSidebar: Story = {
  render: (args) => (
    <DashboardLayout
      sidebar={<div className="pt-9 text-sm">Sidebar</div>}
      tabs={<AppTabStrip {...args} />}
    >
      <div className="p-4 text-sm">Inbox</div>
    </DashboardLayout>
  ),
};
