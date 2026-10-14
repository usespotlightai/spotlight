import { Skeleton } from '@/components/shared/skeleton/Skeleton';

const PANELS = [
  'Agent',
  'Prompt',
  'Skills',
  'Judge',
  'Ships through',
  'Version',
] as const;

export function StationConfigSkeleton() {
  return (
    <section className="flex flex-col gap-1.5">
      <h2 className="font-medium text-foreground text-xs">Config</h2>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {PANELS.map((title) => (
          <Skeleton key={title} className="h-61 rounded-lg" />
        ))}
      </div>
    </section>
  );
}
