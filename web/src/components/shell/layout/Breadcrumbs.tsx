import { ChevronRight } from 'lucide-react';
import { Fragment } from 'react';
import { Link } from 'react-router';
import { InitialAvatar } from '@/components/shared/avatar/InitialAvatar';
import { Shortened } from '@/components/shell/layout/Shortened';

const LABEL_WIDTH = 256;

/** This type must remain serialisable because crumbs go in the navigation state. */
export type BreadcrumbSegment = {
  label: string;
  avatar?: string;
  to?: string;
};

type BreadcrumbsProps = {
  segments: readonly BreadcrumbSegment[];
};

export function Breadcrumbs({ segments }: BreadcrumbsProps) {
  return segments.map(({ label, avatar, to }, index) => {
    const content = (
      <>
        {avatar && <InitialAvatar name={avatar} className="bg-card" />}
        <Shortened
          text={label}
          max={LABEL_WIDTH}
          className="whitespace-nowrap"
        />
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
