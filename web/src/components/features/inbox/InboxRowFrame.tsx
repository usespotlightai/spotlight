import { type ReactElement, type ReactNode, useState } from 'react';
import { NavLink, useLocation, useResolvedPath } from 'react-router';

import { ResolveToggle } from '@/components/features/inbox/ResolveToggle';
import { CommandScope } from '@/components/shell/command/CommandScope';
import { useFocusWithin } from '@/hooks/useFocusWithin';
import { useMenuActions } from '@/hooks/useMenuActions';
import { useOpenIntent } from '@/hooks/useOpenIntent';
import type { MenuAction } from '@/lib/context-menu';
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
  resolve?: MenuAction | null;
  menuActions?: readonly MenuAction[];
  onOpen?: () => void;
  onIntent?: () => void;
};

export function InboxRowFrame({
  to,
  icon,
  title,
  unread,
  at,
  preview,
  badge,
  resolve,
  menuActions = [],
  onOpen,
  onIntent,
}: InboxRowFrameProps): ReactElement {
  const intent = useOpenIntent(onIntent);
  const trail = useForwardTrail();
  const { focused, handlers } = useFocusWithin();
  const [hovered, setHovered] = useState(false);
  const target = useResolvedPath(to).pathname;
  const { pathname } = useLocation();
  const current = pathname === target || pathname.startsWith(`${target}/`);
  const menu = useMenuActions(
    resolve ? [resolve, ...menuActions] : menuActions,
  );

  return (
    <div
      data-list-item
      {...handlers}
      {...menu}
      onPointerEnter={() => {
        setHovered(true);
        intent.onPointerEnter?.();
      }}
      onPointerLeave={() => {
        setHovered(false);
        intent.onPointerLeave?.();
      }}
      onFocusCapture={intent.onFocusCapture}
      className="group/row relative flex items-start gap-2 rounded-md px-2 py-2 transition-colors hover:bg-accent has-[a[aria-current=page]]:bg-accent has-[a:focus-visible]:ring-1 has-[a:focus-visible]:ring-primary has-[a:focus-visible]:ring-inset"
    >
      <NavLink
        to={to}
        onClick={onOpen}
        state={trail.length > 0 ? { trail } : undefined}
        className="flex min-w-0 flex-1 flex-col gap-0.5 outline-none after:absolute after:inset-0 after:rounded-md"
      >
        <span className="flex min-w-0 items-center gap-2">
          {icon}

          <span
            title={title}
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

        <span
          title={preview}
          className="truncate pl-6 text-muted-foreground text-xs"
        >
          {preview}
        </span>
      </NavLink>

      <span className="relative z-10 flex h-5 shrink-0 items-center gap-1">
        <CommandScope
          active={hovered || focused || current}
          rank={hovered ? 3 : focused ? 2 : 1}
        >
          {resolve && <ResolveToggle action={resolve} />}
        </CommandScope>

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
