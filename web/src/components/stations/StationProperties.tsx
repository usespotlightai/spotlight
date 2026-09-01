import { HarnessSelect } from '@/components/stations/HarnessSelect';
import { StationReactions } from '@/components/stations/StationReactions';

type Reaction = {
  happening: string;
  from?: string | null;
  to: string;
};

type Station = {
  id: string;
  name: string;
};

type StationPropertiesProps = {
  slug: string | undefined;
  stationId: string;
  stations: readonly Station[];
  reactions: readonly Reaction[];
  onReactions: (reactions: Reaction[]) => void;
  /** Absent where nothing runs at this station. */
  harness?: string;
  onHarness?: (harness: string) => void;
  /** Said in place of a harness, where there is nothing to run. */
  note?: string;
};

export function StationProperties({
  slug,
  stationId,
  stations,
  reactions,
  onReactions,
  harness,
  onHarness,
  note,
}: StationPropertiesProps) {
  return (
    <aside className="sticky top-8 hidden w-56 shrink-0 flex-col gap-4 self-start lg:flex">
      {harness !== undefined && onHarness ? (
        <section className="flex flex-col gap-1">
          <h2 className="px-2 font-medium text-muted-foreground text-xs">
            Worked by
          </h2>

          <HarnessSelect value={harness} onChange={onHarness} />
        </section>
      ) : null}

      {note ? (
        <p className="px-2 text-muted-foreground text-xs leading-5">{note}</p>
      ) : null}

      <StationReactions
        slug={slug}
        stationId={stationId}
        stations={stations}
        reactions={reactions}
        onChange={onReactions}
      />
    </aside>
  );
}
