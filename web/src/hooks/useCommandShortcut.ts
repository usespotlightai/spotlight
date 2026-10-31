import { useEffect } from 'react';
import { isCommandShortcut } from '@/lib/command';

export function useCommandShortcut(onToggle: () => void) {
  useEffect(() => {
    const pressed = (event: KeyboardEvent) => {
      if (!isCommandShortcut(event)) {
        return;
      }

      event.preventDefault();
      onToggle();
    };

    document.addEventListener('keydown', pressed);

    return () => document.removeEventListener('keydown', pressed);
  }, [onToggle]);
}
