import { FixedAgent } from '@/components/features/stations/FixedAgent';
import { FixedRepositories } from '@/components/features/stations/FixedRepositories';
import { ComposerFooter } from '@/components/shared/ComposerFooter';
import { ChatInput } from '@/components/shared/chat-input/ChatInput';
import type { RunAgentResponseDto } from '@/lib/api';

type AutonomousComposerProps = {
  slug: string;
  agent: RunAgentResponseDto | null;
  repositories?: readonly string[];
};

export function AutonomousComposer({
  slug,
  agent,
  repositories,
}: AutonomousComposerProps) {
  return (
    <ComposerFooter>
      <ChatInput
        slug={slug}
        label="Message the agent"
        placeholder="This agent runs autonomously and can’t receive messages."
        disabled
        settings={<FixedAgent agent={agent} />}
        below={
          repositories && (
            <FixedRepositories slug={slug} repositories={repositories} />
          )
        }
      />
    </ComposerFooter>
  );
}
