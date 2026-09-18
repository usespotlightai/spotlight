import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

type View<T extends string> = {
  readonly id: T;
  readonly label: string;
};

type ViewPillsProps<T extends string> = {
  views: readonly View<T>[];
  current: T;
  onChange: (view: T) => void;
};

export function ViewPills<T extends string>({
  views,
  current,
  onChange,
}: ViewPillsProps<T>) {
  return (
    <div className="flex h-10 shrink-0 items-center gap-1 px-3">
      {views.map((view) => (
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
