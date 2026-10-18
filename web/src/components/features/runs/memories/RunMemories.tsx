import { Spool } from 'lucide-react';
import { IconAction } from '@/components/shared/IconAction';
import { useRunMemories } from '@/hooks/api/useRunMemories';
import { hasNoMemories, memoryCounts } from '@/lib/memory';
import { failed } from '@/lib/query';
import { useRunSidePanel } from '@/lib/run-side-panel';

type RunMemoriesProps = {
  slug: string;
  teamId: string;
  runId: string;
};

export function RunMemories({ slug, teamId, runId }: RunMemoriesProps) {
  const query = useRunMemories(teamId, runId);
  const panel = useRunSidePanel();

  const memories = query.data;

  if (!failed(query) && memories && hasNoMemories(memories)) {
    return null;
  }

  const showing = panel.memories?.runId === runId;

  return (
    <IconAction
      label="Memories"
      tip={
        <span className="flex flex-col gap-1">
          <span className="font-medium">Memories</span>
          {memories && !failed(query) && (
            <dl className="grid grid-cols-[auto_auto] gap-x-4">
              {memoryCounts(memories).map(({ what, count }) => (
                <div key={what} className="contents">
                  <dt className="text-muted-foreground">{what}</dt>
                  <dd className="text-right tabular-nums">{count}</dd>
                </div>
              ))}
            </dl>
          )}
        </span>
      }
      pressed={showing}
      onClick={() =>
        showing ? panel.close() : panel.openMemories({ slug, teamId, runId })
      }
    >
      <Spool aria-hidden />
    </IconAction>
  );
}
