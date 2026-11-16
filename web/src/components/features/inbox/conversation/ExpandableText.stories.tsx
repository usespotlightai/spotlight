import type { Meta, StoryObj } from '@storybook/react-vite';

import { WorldMessage } from '@/components/features/inbox/conversation/WorldMessage';
import { BriefingCard } from '@/components/features/runs/BriefingCard';

const BRIEFING = Array.from(
  { length: 12 },
  (_, line) =>
    `Line ${line + 1} of the prompt. Hand the task over with spotlight handover when you finish, and put any question in the note.`,
).join('\n\n');

const FAILURE = [
  'Failed: generate.',
  '**generate** failed at the step "The committed client matches the schema". The end of its log:',
  '```',
  ...Array.from(
    { length: 20 },
    (_, line) => `-   line ${line + 1} of the diff`,
  ),
  '```',
].join('\n');

function Messages() {
  return (
    <div className="mx-auto flex max-w-2xl flex-col gap-6 p-6">
      <BriefingCard briefing={BRIEFING} attachments={[]} />
      <WorldMessage
        body={FAILURE}
        attachments={[]}
        authors={[]}
        source={{ integration: 'github', name: 'GitHub', logo: null }}
        deferredTo={null}
      />
      <WorldMessage
        body="The checks passed."
        attachments={[]}
        authors={[]}
        source={{ integration: 'github', name: 'GitHub', logo: null }}
        deferredTo={null}
      />
    </div>
  );
}

const meta = {
  title: 'Team/Runs/Run/Long messages',
  component: Messages,
} satisfies Meta<typeof Messages>;

export default meta;

export const Default: StoryObj<typeof meta> = {};
