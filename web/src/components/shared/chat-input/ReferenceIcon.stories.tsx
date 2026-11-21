import type { Meta, StoryObj } from '@storybook/react-vite';

import { ReferenceToken } from '@/components/shared/chat-input/ReferenceToken';

const NAMES = [
  'demo.mov',
  'voice.mp3',
  'photo.png',
  'bundle.zip',
  'sheet.csv',
  'config.json',
  'server.log',
  'deploy.sh',
  'schema.sql',
  'main.ts',
  'report.pdf',
  'notes.md',
];

const meta = {
  title: 'Chat/Reference icons',
  component: ReferenceToken,
  render: () => (
    <div className="flex max-w-xl flex-wrap gap-2 p-6">
      {NAMES.map((name) => (
        <ReferenceToken
          key={name}
          reference={{ kind: 'file', key: name, name }}
        />
      ))}
    </div>
  ),
} satisfies Meta<typeof ReferenceToken>;

export default meta;

export const Formats: StoryObj<typeof meta> = {
  args: { reference: { kind: 'file', key: 'demo.mov', name: 'demo.mov' } },
};
