import { ChevronLeft, ChevronRight } from 'lucide-react';

import { Button } from '@/components/ui/button';
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/tooltip';

type InsightsPagerProps = {
  label: string;
  shown: string;
  page: number;
  lastPage: number;
  onPage: (page: number) => void;
};

export function InsightsPager({
  label,
  shown,
  page,
  lastPage,
  onPage,
}: InsightsPagerProps) {
  return (
    <nav
      aria-label={label}
      className="flex items-center justify-end gap-2 text-muted-foreground text-xs"
    >
      <span className="tabular-nums">{shown}</span>
      <Tooltip>
        <TooltipTrigger
          iconOnly
          render={
            <Button
              type="button"
              variant="outline"
              size="icon-xs"
              className="pointer-coarse:size-9"
              aria-label="Previous page"
              disabled={page <= 1}
              onClick={() => onPage(page - 1)}
            />
          }
        >
          <ChevronLeft aria-hidden />
        </TooltipTrigger>
        <TooltipContent>Previous page</TooltipContent>
      </Tooltip>
      <Tooltip>
        <TooltipTrigger
          iconOnly
          render={
            <Button
              type="button"
              variant="outline"
              size="icon-xs"
              className="pointer-coarse:size-9"
              aria-label="Next page"
              disabled={page >= lastPage}
              onClick={() => onPage(page + 1)}
            />
          }
        >
          <ChevronRight aria-hidden />
        </TooltipTrigger>
        <TooltipContent>Next page</TooltipContent>
      </Tooltip>
    </nav>
  );
}
