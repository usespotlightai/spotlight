import { Spool } from 'lucide-react';
import { IconAction } from '@/components/shared/IconAction';
import { useRunMemories } from '@/hooks/api/useRunMemories';
import { rememberedCounts, rememberedNothing } from '@/lib/memory';
import { failed } from '@/lib/query';
import { useRunSidePanel } from '@/lib/run-side-panel';

type RunRememberedProps = {
  slug: string;
  teamId: string;
  runId: string;
};

export function RunRemembered({ slug, teamId, runId }: RunRememberedProps) {
  const query = useRunMemories(teamId, runId);
  const panel = useRunSidePanel();

  const remembered = query.data;

  if (!failed(query) && remembered && rememberedNothing(remembered)) {
    return null;
  }

  const showing = panel.remembered?.runId === runId;

  return (
    <IconAction
      label="Memories"
      tip={
        <span className="flex flex-col gap-1">
          <span className="font-medium">Memories</span>
          {remembered && !failed(query) && (
            <dl className="grid grid-cols-[auto_auto] gap-x-4">
              {rememberedCounts(remembered).map(({ what, count }) => (
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
        showing ? panel.close() : panel.openRemembered({ slug, teamId, runId })
      }
    >
      <Spool aria-hidden />
    </IconAction>
  );
}
