import type { ReactElement } from 'react';

import { SeeLinks } from '@/components/shared/SeeLinks';
import type { CitedPlace } from '@/lib/change-stack';

type CitedPlacesProps = {
  places: readonly CitedPlace[];
  onReveal: (place: CitedPlace) => void;
};

const nameOf = (path: string): string => path.split('/').pop() ?? path;

export function CitedPlaces({
  places,
  onReveal,
}: CitedPlacesProps): ReactElement {
  return (
    <SeeLinks
      links={places.map((place) => ({
        key: place.path,
        label: `${nameOf(place.path)}:${place.line}`,
        title: place.path,
        onClick: () => onReveal(place),
      }))}
    />
  );
}
