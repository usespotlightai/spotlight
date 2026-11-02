import type { CitedPlace } from '@/lib/change-stack';

type CitedPlacesProps = {
  places: readonly CitedPlace[];
  onReveal: (place: CitedPlace) => void;
};

const nameOf = (path: string): string => path.split('/').pop() ?? path;

export function CitedPlaces({ places, onReveal }: CitedPlacesProps) {
  if (places.length === 0) {
    return null;
  }

  return (
    <p className="flex flex-wrap items-center gap-x-2 text-muted-foreground text-sm leading-5">
      <span>See</span>
      {places.map((place) => (
        <button
          key={place.path}
          type="button"
          title={place.path}
          onClick={() => onReveal(place)}
          className="underline-offset-2 outline-none hover:text-foreground hover:underline focus-visible:underline"
        >
          {nameOf(place.path)}:{place.line}
        </button>
      ))}
    </p>
  );
}
