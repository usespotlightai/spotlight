import { SharedTraceChip } from '@/components/features/agent/SharedTraceChip';
import { TrailLink } from '@/components/shell/layout/TrailLink';
import type { SharedTrace } from '@/lib/chat';
import { taskTracePath } from '@/lib/task';

type SharedTracesProps = {
  slug: string;
  teamId: string;
  traces: readonly SharedTrace[];
};

export function SharedTraces({ slug, teamId, traces }: SharedTracesProps) {
  if (traces.length === 0) {
    return null;
  }

  return (
    <ul aria-label="Shared traces" className="flex flex-wrap gap-2">
      {traces.map((trace) => (
        <li key={trace.taskId}>
          <TrailLink
            to={taskTracePath(slug, teamId, trace.taskId)}
            className="block rounded-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            <SharedTraceChip trace={trace} className="hover:bg-accent" />
          </TrailLink>
        </li>
      ))}
    </ul>
  );
}
