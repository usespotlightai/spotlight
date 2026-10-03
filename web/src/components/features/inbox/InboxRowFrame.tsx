import type { ReactNode } from 'react';
import { NavLink } from 'react-router';
import { raisedOn } from '@/lib/task';
import { useForwardTrail } from '@/lib/trail';
import { cn } from '@/lib/utils';

type InboxRowFrameProps = {
  to: string;
  icon: ReactNode;
  title: string;
  unread: boolean;
  at: string;
  preview: string;
  badge?: ReactNode;
};

export function InboxRowFrame({
  to,
  icon,
  title,
  unread,
  at,
  preview,
  badge,
}: InboxRowFrameProps) {
  const trail = useForwardTrail();

  return (
    <NavLink
      to={to}
      state={trail.length > 0 ? { trail } : undefined}
      className={({ isActive }) =>
        cn(
          'flex flex-col gap-0.5 rounded-md px-2 py-2 outline-none transition-colors',
          isActive ? 'bg-accent' : 'hover:bg-accent',
        )
      }
    >
      <span className="flex min-w-0 items-center gap-2">
        {icon}

        <span
          className={cn(
            'truncate text-sm',
            unread
              ? 'font-semibold text-foreground'
              : 'font-medium text-muted-foreground',
          )}
        >
          {title}
        </span>

        {badge}

        {unread && (
          <>
            <span className="sr-only">Unread</span>
            <span
              aria-hidden
              className="size-1.5 shrink-0 rounded-full bg-primary"
            />
          </>
        )}

        <time
          dateTime={at}
          className="ml-auto shrink-0 text-muted-foreground text-xs tabular-nums"
        >
          {raisedOn(at)}
        </time>
      </span>

      <span className="truncate pl-6 text-muted-foreground text-xs">
        {preview}
      </span>
    </NavLink>
  );
}
