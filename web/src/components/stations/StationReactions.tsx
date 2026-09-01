import { Checkbox } from '@/components/ui/checkbox';
import { useHappenings } from '@/hooks/api/useHappenings';

type Reaction = {
  happening: string;
  from?: string | null;
  to: string;
};

type Station = {
  id: string;
  name: string;
};

type StationReactionsProps = {
  slug: string | undefined;
  stationId: string;
  stations: readonly Station[];
  reactions: readonly Reaction[];
  onChange: (reactions: Reaction[]) => void;
};

/**
 * What brings a task here from outside. The rules belong to the line, so
 * turning one on here takes it from whichever station held it: a word can
 * only ever lead to one place.
 */
export function StationReactions({
  slug,
  stationId,
  stations,
  reactions,
  onChange,
}: StationReactionsProps) {
  const { data: happenings } = useHappenings(slug);

  if (!happenings?.length) {
    return null;
  }

  const leadingTo = (happening: string) =>
    reactions.find((each) => each.happening === happening)?.to;

  const toggle = (happening: string, on: boolean) => {
    const others = reactions.filter((each) => each.happening !== happening);

    onChange(
      on ? [...others, { happening, from: null, to: stationId }] : others,
    );
  };

  return (
    <section className="flex flex-col gap-1">
      <h2 className="px-2 font-medium text-muted-foreground text-xs">
        Brought here by
      </h2>

      <div
        role="group"
        aria-label="Brought here by"
        className="flex flex-col"
      >
        {happenings.map((each) => {
          const to = leadingTo(each.happening);
          const here = to === stationId;
          const elsewhere =
            to && !here
              ? stations.find((station) => station.id === to)?.name
              : null;

          return (
            <div
              key={each.happening}
              className="flex items-start gap-2 rounded-md px-2 py-1.5 text-sm transition-colors hover:bg-accent"
            >
              <Checkbox
                id={`reacts-${each.happening}`}
                className="mt-0.5"
                checked={here}
                onCheckedChange={(next) => toggle(each.happening, next)}
              />
              <label
                htmlFor={`reacts-${each.happening}`}
                className="flex min-w-0 cursor-pointer flex-col"
              >
                <span className="truncate">{each.label}</span>
                {elsewhere ? (
                  <span className="truncate text-muted-foreground text-xs">
                    Goes to {elsewhere}
                  </span>
                ) : null}
              </label>
            </div>
          );
        })}
      </div>
    </section>
  );
}
