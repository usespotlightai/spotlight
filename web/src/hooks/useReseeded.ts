import { type Dispatch, type SetStateAction, useState } from 'react';

export function useReseeded<T>(
  owner: string | undefined,
  seed: () => T,
): [T, Dispatch<SetStateAction<T>>] {
  const [seededFor, setSeededFor] = useState(owner);
  const [value, setValue] = useState(seed);

  if (owner !== undefined && owner !== seededFor) {
    setSeededFor(owner);
    setValue(seed());
  }

  return [value, setValue];
}
