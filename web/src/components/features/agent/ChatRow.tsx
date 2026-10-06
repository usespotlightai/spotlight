import { HarnessLogo } from '@/components/features/stations/HarnessLogo';
import { InProgress } from '@/components/shared/InProgress';
import { TrailLink } from '@/components/shell/layout/TrailLink';
import type { ChatSummary } from '@/lib/chat';
import { since } from '@/lib/since';

type ChatRowProps = {
  chat: ChatSummary;
  to: string;
};

export function ChatRow({ chat, to }: ChatRowProps) {
  return (
    <li className="relative flex h-9 min-w-0 items-center gap-2 rounded-md px-2 text-sm transition-colors hover:bg-accent">
      <HarnessLogo harness={chat.harness} />

      <TrailLink
        to={to}
        className="min-w-0 truncate text-foreground outline-none after:absolute after:inset-0 after:rounded-md"
      >
        {chat.title}
      </TrailLink>

      <span className="ml-auto flex shrink-0 items-center gap-2">
        {chat.working && <InProgress />}

        <span className="w-20 shrink-0 text-right text-muted-foreground text-xs tabular-nums">
          {since(chat.updatedAt)}
        </span>
      </span>
    </li>
  );
}
