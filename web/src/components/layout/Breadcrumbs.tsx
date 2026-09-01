import { ChevronRight } from 'lucide-react';
import { Fragment, type ReactNode } from 'react';
import { Link } from 'react-router';

export type BreadcrumbSegment = {
  label: string;
  icon?: ReactNode;
  to?: string;
};

type BreadcrumbsProps = {
  segments: readonly BreadcrumbSegment[];
};

export function Breadcrumbs({ segments }: BreadcrumbsProps) {
  return segments.map(({ label, icon, to }, index) => {
    const content = (
      <>
        {icon}
        {/* Capped so one long title cannot crowd out the trail it sits in. */}
        <span className="max-w-64 truncate" title={label}>
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
            className="size-3.5 shrink-0 text-muted-foreground"
            aria-hidden
          />
        )}

        {to ? (
          <Link
            to={to}
            className="-mx-1.5 flex min-w-0 items-center gap-1.5 rounded-md px-1.5 py-0.5 outline-none transition-colors hover:bg-accent"
          >
            {content}
          </Link>
        ) : (
          <span className="flex min-w-0 items-center gap-1.5">{content}</span>
        )}
      </Fragment>
    );
  });
}
