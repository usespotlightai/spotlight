import { RunMemories } from '@/components/features/runs/memories/RunMemories';
import { CopyIcon } from '@/components/shared/CopyIcon';
import { IconAction } from '@/components/shared/IconAction';
import { useCopied } from '@/hooks/useCopied';
import { since } from '@/lib/since';

type RunActionsProps = {
  slug: string;
  teamId: string;
  runId: string;
  thread: string;
  at: string;
};

export function RunActions({
  slug,
  teamId,
  runId,
  thread,
  at,
}: RunActionsProps) {
  const { copied, copy } = useCopied();

  return (
    <div
      role="toolbar"
      aria-label="Run actions"
      className="-ml-1 flex items-center gap-0.5"
    >
      <IconAction
        label={copied ? 'Copied' : 'Copy the conversation'}
        onClick={() => void copy(thread)}
      >
        <CopyIcon copied={copied} />
      </IconAction>

      <RunMemories slug={slug} teamId={teamId} runId={runId} />

      <span className="ml-1.5 flex items-center gap-1.5 text-muted-foreground text-xs">
        <span aria-hidden>·</span>
        <time dateTime={at} className="tabular-nums">
          {since(at)}
        </time>
      </span>
    </div>
  );
}
