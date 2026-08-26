import { ChevronRight } from 'lucide-react';
import { Fragment, type ReactNode } from 'react';

export type BreadcrumbSegment = {
  label: string;
  icon?: ReactNode;
};

type BreadcrumbsProps = {
  segments: readonly BreadcrumbSegment[];
};

export function Breadcrumbs({ segments }: BreadcrumbsProps) {
  return segments.map(({ label, icon }, index) => (
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
      <span className="flex min-w-0 items-center gap-1.5">
        {icon}
        <span className="truncate">{label}</span>
      </span>
    </Fragment>
  ));
}
