import type { Meta, StoryObj } from '@storybook/react-vite';
import { StationConfigSkeleton } from '@/components/features/stations/config/StationConfigSkeleton';

const meta = {
  title: 'Stations/StationConfigSkeleton',
  component: StationConfigSkeleton,
} satisfies Meta<typeof StationConfigSkeleton>;

export default meta;

export const Loading: StoryObj<typeof meta> = {};
