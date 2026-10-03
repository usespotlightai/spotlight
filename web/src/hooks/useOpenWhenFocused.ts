import { useState } from 'react';

export function useOpenWhenFocused(focused: boolean) {
  const [open, setOpen] = useState(false);
  const [held, setHeld] = useState(false);

  if (focused !== held) {
    setHeld(focused);

    if (focused) {
      setOpen(true);
    }
  }

  return { open, toggle: () => setOpen(!open) };
}
