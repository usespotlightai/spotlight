import { Button } from '@/components/ui/button';
import { BOARD_VIEWS, type BoardView } from '@/lib/board';
import { cn } from '@/lib/utils';

type BoardViewsProps = {
  current: BoardView;
  onChange: (view: BoardView) => void;
};

export function BoardViews({ current, onChange }: BoardViewsProps) {
  return (
    <div
      data-slot="board-views"
      className="flex h-10 shrink-0 items-center gap-1 px-3"
    >
      {BOARD_VIEWS.map((view) => (
        <Button
          key={view.id}
          variant="outline"
          size="sm"
          onClick={() => onChange(view.id)}
          aria-current={view.id === current ? 'page' : undefined}
          className={cn(
            'rounded-full bg-card shadow-xs',
            view.id === current && 'bg-muted',
          )}
        >
          {view.label}
        </Button>
      ))}
    </div>
  );
}
