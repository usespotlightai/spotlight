import { useEffect } from 'react';

export function useCommandShortcut(onToggle: () => void) {
  useEffect(() => {
    const pressed = (event: KeyboardEvent) => {
      if (
        event.key.toLowerCase() !== 'k' ||
        !(event.metaKey || event.ctrlKey)
      ) {
        return;
      }

      event.preventDefault();
      onToggle();
    };

    document.addEventListener('keydown', pressed);

    return () => document.removeEventListener('keydown', pressed);
  }, [onToggle]);
}
