import { NavLink } from 'react-router';
import { StationIcon } from '@/components/board/StationIcon';
import { type InboxItem, inboxItemPath, waitingOn } from '@/lib/inbox';
import { raisedOn } from '@/lib/task';
import { cn } from '@/lib/utils';

type InboxRowProps = {
  slug: string;
  item: InboxItem;
};

export function InboxRow({ slug, item }: InboxRowProps) {
  const asked = waitingOn(item);

  return (
    <NavLink
      to={inboxItemPath(slug, item.taskId)}
      className={({ isActive }) =>
        cn(
          'flex flex-col gap-0.5 rounded-md px-2 py-2 outline-none transition-colors',
          isActive ? 'bg-accent' : 'hover:bg-accent',
        )
      }
    >
      <span className="flex min-w-0 items-center gap-2">
        <StationIcon share={1} color={item.stationColor} />

        <span className="truncate font-medium text-foreground text-sm">
          {item.title}
        </span>

        <time
          dateTime={item.askedAt}
          className="ml-auto shrink-0 text-muted-foreground text-xs tabular-nums"
        >
          {raisedOn(item.askedAt)}
        </time>
      </span>

      <span className="truncate pl-6 text-muted-foreground text-xs">
        {asked ? asked.body : `Waiting at ${item.station}`}
      </span>
    </NavLink>
  );
}
