import { ChevronRight } from 'lucide-react';
import { Fragment } from 'react';
import { Link } from 'react-router';

import { InitialAvatar } from '@/components/shared/avatar/InitialAvatar';
import { useTabTitle } from '@/lib/tab-title';
import { cn } from '@/lib/utils';

/** This type must remain serialisable because crumbs go in the navigation state. */
export type BreadcrumbSegment = {
  label: string;
  avatar?: string;
  to?: string;
};

const SHORT_LABEL = 10;

const fitOf = (label: string, parent: boolean) => {
  if (!parent) {
    return 'min-w-16';
  }

  return label.length <= SHORT_LABEL ? 'shrink-0' : 'min-w-12 shrink-[10000]';
};

type BreadcrumbsProps = {
  segments: readonly BreadcrumbSegment[];
  namesTab?: boolean;
};

export function Breadcrumbs({ segments, namesTab = true }: BreadcrumbsProps) {
  useTabTitle(namesTab ? segments.at(-1)?.label : undefined);

  const last = segments.length - 1;

  return segments.map(({ label, avatar, to }, index) => {
    const folds = avatar !== undefined && index < last;
    const crumb = cn(
      'flex min-w-0 items-center gap-1.5',
      fitOf(label, index < last),
      index < last - 1 && '@max-[40rem]/pane:hidden',
      folds && '@max-[40rem]/pane:min-w-0 @max-[40rem]/pane:shrink-0',
    );
    const content = (
      <>
        {avatar && <InitialAvatar name={avatar} className="bg-card" />}
        <span className={cn('truncate', folds && '@max-[40rem]/pane:sr-only')}>
          {label}
        </span>
      </>
    );

    return (
      <Fragment
        key={segments
          .slice(0, index + 1)
          .map((each) => each.label)
          .join('/')}
      >
        {index > 0 && (
          <ChevronRight
            className={cn(
              'size-3.5 shrink-0 text-muted-foreground',
              index < last && '@max-[40rem]/pane:hidden',
            )}
            aria-hidden
          />
        )}

        {to ? (
          <Link
            to={to}
            title={label}
            className={cn(
              crumb,
              '-mx-1.5 rounded-md px-1.5 py-0.5 outline-none transition-colors hover:bg-accent',
            )}
          >
            {content}
          </Link>
        ) : (
          <span title={label} className={crumb}>
            {content}
          </span>
        )}
      </Fragment>
    );
  });
}
