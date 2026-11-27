import { useState } from 'react';

type OpenWhenFocusedResult = { open: boolean; toggle: () => void };

export function useOpenWhenFocused(focused: boolean): OpenWhenFocusedResult {
  const [open, setOpen] = useState(false);
  const [wasFocused, setWasFocused] = useState(false);

  if (focused !== wasFocused) {
    setWasFocused(focused);

    if (focused) {
      setOpen(true);
    }
  }

  return { open, toggle: () => setOpen(!open) };
}
