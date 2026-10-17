import { useState } from 'react';

export function useOpenWhenFocused(focused: boolean) {
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
