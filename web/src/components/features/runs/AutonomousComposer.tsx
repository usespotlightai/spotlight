import { FixedAgent } from '@/components/features/stations/FixedAgent';
import { FixedRepositories } from '@/components/features/stations/FixedRepositories';
import { ComposerFooter } from '@/components/shared/ComposerFooter';
import { ChatInput } from '@/components/shared/chat-input/ChatInput';
import type { RunAgentResponseDto } from '@/lib/api';
import { LINE_SETS_REPOSITORIES, RUNS_AUTONOMOUSLY } from '@/lib/run';

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
        placeholder={RUNS_AUTONOMOUSLY}
        disabled
        settings={<FixedAgent agent={agent} />}
        below={
          repositories && (
            <FixedRepositories
              slug={slug}
              repositories={repositories}
              because={LINE_SETS_REPOSITORIES}
            />
          )
        }
      />
    </ComposerFooter>
  );
}
