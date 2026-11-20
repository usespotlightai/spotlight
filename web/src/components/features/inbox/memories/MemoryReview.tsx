import { use } from 'react';

import { MemoryDecision } from '@/components/features/inbox/memories/MemoryDecision';
import { Dockable } from '@/components/shared/decision-tray/Dockable';
import { DecisionTrayContext, dockedRuns } from '@/lib/decision-tray';
import { memoryDecisionId, type ProposedMemory } from '@/lib/memory';

type MemoryReviewProps = {
  slug: string;
  teamId: string;
  taskId: string;
  runId: string;
  memories: readonly ProposedMemory[];
};

export function MemoryReview({ memories, ...about }: MemoryReviewProps) {
  const runs = dockedRuns(
    use(DecisionTrayContext),
    memories.map(memoryDecisionId),
  );

  return (
    <ul className="flex flex-col gap-3">
      {memories.map((memory, at) => {
        const id = memoryDecisionId(memory);
        const run = runs.get(id);

        return (
          run !== 0 && (
            <li key={memory.id}>
              <Dockable id={id} run={run}>
                <MemoryDecision {...about} memory={memory} position={at + 1} />
              </Dockable>
            </li>
          )
        );
      })}
    </ul>
  );
}
