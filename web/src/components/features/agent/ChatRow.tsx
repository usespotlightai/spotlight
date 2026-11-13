import { HarnessLogo } from '@/components/features/stations/HarnessLogo';
import { ProgressState } from '@/components/shared/ProgressState';
import { WaitingForYouPill } from '@/components/shared/WaitingForYouPill';
import { TrailLink } from '@/components/shell/layout/TrailLink';
import type { ChatSummary } from '@/lib/chat';
import { since } from '@/lib/since';
import { cn } from '@/lib/utils';

type ChatRowProps = {
  chat: ChatSummary;
  to: string;
};

export function ChatRow({ chat, to }: ChatRowProps) {
  const status = chat.waitingForYou ? (
    <WaitingForYouPill />
  ) : (
    chat.progress && <ProgressState progress={chat.progress} />
  );

  return (
    <li
      className={cn(
        'relative grid min-h-9 pointer-coarse:min-h-11 grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-x-2 gap-y-1 rounded-md px-2 py-1.5 text-sm transition-colors hover:bg-accent @md/pane:h-9 @md/pane:py-0',
        status && '@md/pane:grid-cols-[auto_minmax(0,1fr)_auto_auto]',
      )}
    >
      <HarnessLogo harness={chat.harness} />

      <TrailLink
        to={to}
        title={chat.title}
        className="min-w-0 truncate text-foreground outline-none after:absolute after:inset-0 after:rounded-md"
      >
        {chat.title}
      </TrailLink>

      {status && (
        <span className="col-start-2 row-start-2 flex justify-self-start @md/pane:col-start-3 @md/pane:row-start-1">
          {status}
        </span>
      )}

      <span
        className={cn(
          'col-start-3 row-start-1 text-right text-muted-foreground text-xs tabular-nums @md/pane:w-20',
          status && '@md/pane:col-start-4',
        )}
      >
        {since(chat.updatedAt)}
      </span>
    </li>
  );
}
