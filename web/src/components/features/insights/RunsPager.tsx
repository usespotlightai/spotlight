import { ChevronLeft, ChevronRight } from 'lucide-react';
import { Button } from '@/components/ui/button';

type RunsPagerProps = {
  shown: string;
  page: number;
  lastPage: number;
  onPage: (page: number) => void;
};

export function RunsPager({ shown, page, lastPage, onPage }: RunsPagerProps) {
  return (
    <nav
      aria-label="Pages of runs"
      className="flex items-center justify-end gap-2 text-muted-foreground text-xs"
    >
      <span className="tabular-nums">{shown}</span>
      <Button
        type="button"
        variant="outline"
        size="icon-sm"
        aria-label="Previous page"
        disabled={page <= 1}
        onClick={() => onPage(page - 1)}
      >
        <ChevronLeft aria-hidden />
      </Button>
      <Button
        type="button"
        variant="outline"
        size="icon-sm"
        aria-label="Next page"
        disabled={page >= lastPage}
        onClick={() => onPage(page + 1)}
      >
        <ChevronRight aria-hidden />
      </Button>
    </nav>
  );
}
