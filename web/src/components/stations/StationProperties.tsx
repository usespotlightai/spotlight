import { RunnerPoolSelect } from '@/components/stations/RunnerPoolSelect';

type StationPropertiesProps = {
  pool: string;
  onPool: (pool: string) => void;
};

export function StationProperties({ pool, onPool }: StationPropertiesProps) {
  return (
    <aside className="sticky top-8 hidden w-56 shrink-0 flex-col gap-4 self-start lg:flex">
      <section className="flex flex-col gap-1">
        <h2 className="px-2 font-medium text-muted-foreground text-xs">
          Runner Pool
        </h2>

        <RunnerPoolSelect value={pool} onChange={onPool} />
      </section>
    </aside>
  );
}
