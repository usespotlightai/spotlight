import type { Meta, StoryObj } from '@storybook/react-vite';

import { PromptSection } from '@/components/features/stations/config/PromptSection';

const RULE =
  'Read every file the change touches in full, not only the lines it alters, and check each risk on your list before you look for more.';

const LONG_PROMPT = [
  '## Review',
  'Review the pull request this task names. Your job is to tell the author what is wrong with it and what could be better, not to change it.',
  '## Before you judge',
  ...Array.from({ length: 12 }, () => `- ${RULE}`),
  '## Before you say it',
  ...Array.from({ length: 12 }, () => `- ${RULE}`),
].join('\n\n');

const meta = {
  title: 'Stations/PromptSection',
  component: PromptSection,
  args: { stationId: 'station-1', prompt: LONG_PROMPT },
} satisfies Meta<typeof PromptSection>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Long: Story = {};

export const Short: Story = {
  args: { prompt: 'Review the pull request this task names.' },
};

export const Empty: Story = {
  args: { prompt: null },
};
