import type { ReactNode } from 'react';
import { NavLink } from 'react-router';
import { createdOn } from '@/lib/task';
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
  action?: ReactNode;
};

export function InboxRowFrame({
  to,
  icon,
  title,
  unread,
  at,
  preview,
  badge,
  action,
}: InboxRowFrameProps) {
  const trail = useForwardTrail();

  return (
    <div className="group/row relative flex items-start gap-2 rounded-md px-2 py-2 transition-colors hover:bg-accent has-[a[aria-current=page]]:bg-accent has-[a:focus-visible]:ring-2 has-[a:focus-visible]:ring-ring/50">
      <NavLink
        to={to}
        state={trail.length > 0 ? { trail } : undefined}
        className="flex min-w-0 flex-1 flex-col gap-0.5 outline-none after:absolute after:inset-0 after:rounded-md"
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
        </span>

        <span className="truncate pl-6 text-muted-foreground text-xs">
          {preview}
        </span>
      </NavLink>

      <span className="relative z-10 flex h-5 shrink-0 items-center gap-1">
        {action}

        <time
          dateTime={at}
          className="text-muted-foreground text-xs tabular-nums"
        >
          {createdOn(at)}
        </time>
      </span>
    </div>
  );
}
