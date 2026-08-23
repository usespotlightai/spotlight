import { ChevronRight } from 'lucide-react';
import { Fragment } from 'react';

type BreadcrumbsProps = {
  segments: readonly string[];
};

export function Breadcrumbs({ segments }: BreadcrumbsProps) {
  return segments.map((segment, index) => (
    <Fragment key={segments.slice(0, index + 1).join('/')}>
      {index > 0 && (
        <ChevronRight
          className="size-3.5 shrink-0 text-muted-foreground"
          aria-hidden
        />
      )}
      <span className="truncate">{segment}</span>
    </Fragment>
  ));
}
