import { NavLink } from 'react-router';
import { StationIcon } from '@/components/board/StationIcon';
import { type InboxItem, inboxItemPath, waitingOn } from '@/lib/inbox';
import { stationShare } from '@/lib/station';
import { raisedOn } from '@/lib/task';
import { useForwardTrail } from '@/lib/trail';
import { cn } from '@/lib/utils';

type InboxRowProps = {
  slug: string;
  item: InboxItem;
};

export function InboxRow({ slug, item }: InboxRowProps) {
  const asked = waitingOn(item);
  const trail = useForwardTrail();

  return (
    <NavLink
      to={inboxItemPath(slug, item.id)}
      state={trail.length > 0 ? { trail } : undefined}
      className={({ isActive }) =>
        cn(
          'flex flex-col gap-0.5 rounded-md px-2 py-2 outline-none transition-colors',
          isActive ? 'bg-accent' : 'hover:bg-accent',
        )
      }
    >
      <span className="flex min-w-0 items-center gap-2">
        <StationIcon
          share={stationShare(item.stationPosition, item.stationCount)}
          color={item.stationColor}
        />

        <span
          className={cn(
            'truncate text-sm',
            item.unread
              ? 'font-semibold text-foreground'
              : 'font-medium text-muted-foreground',
          )}
        >
          {item.title}
        </span>

        {item.unread && (
          <>
            <span className="sr-only">Unread</span>
            <span
              aria-hidden
              className="size-1.5 shrink-0 rounded-full bg-primary"
            />
          </>
        )}

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
