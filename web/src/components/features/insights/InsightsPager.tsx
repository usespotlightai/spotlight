import { ChevronLeft, ChevronRight } from 'lucide-react';
import { Button } from '@/components/ui/button';

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
      <Button
        type="button"
        variant="outline"
        size="icon-xs"
        aria-label="Previous page"
        disabled={page <= 1}
        onClick={() => onPage(page - 1)}
      >
        <ChevronLeft aria-hidden />
      </Button>
      <Button
        type="button"
        variant="outline"
        size="icon-xs"
        aria-label="Next page"
        disabled={page >= lastPage}
        onClick={() => onPage(page + 1)}
      >
        <ChevronRight aria-hidden />
      </Button>
    </nav>
  );
}
