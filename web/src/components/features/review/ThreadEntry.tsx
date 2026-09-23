import type { ReactNode } from 'react';

type ThreadEntryProps = {
  avatar: ReactNode;
  author: string;
  meta?: ReactNode;
  first?: boolean;
  children: ReactNode;
};

export function ThreadEntry({
  avatar,
  author,
  meta,
  first = true,
  children,
}: ThreadEntryProps) {
  return (
    <li
      data-slot="thread-entry"
      className={first ? 'flex gap-2.5' : 'flex gap-2.5 pt-3'}
    >
      <div className="flex size-5 shrink-0 items-center justify-center *:size-5!">
        {avatar}
      </div>

      <div className="flex min-w-0 flex-1 flex-col gap-1">
        <div className="flex h-5 items-center gap-2 text-xs">
          <span className="font-medium text-foreground">{author}</span>
          {meta}
        </div>

        {children}
      </div>
    </li>
  );
}
