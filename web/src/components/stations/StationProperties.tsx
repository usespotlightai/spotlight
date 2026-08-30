import { HarnessSelect } from '@/components/stations/HarnessSelect';

type StationPropertiesProps = {
  harness: string;
  onHarness: (harness: string) => void;
};

export function StationProperties({
  harness,
  onHarness,
}: StationPropertiesProps) {
  return (
    <aside className="sticky top-8 hidden w-56 shrink-0 flex-col gap-4 self-start lg:flex">
      <section className="flex flex-col gap-1">
        <h2 className="px-2 font-medium text-muted-foreground text-xs">
          Worked by
        </h2>

        <HarnessSelect value={harness} onChange={onHarness} />
      </section>
    </aside>
  );
}
