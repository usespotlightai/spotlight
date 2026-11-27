import { useEffect, useEffectEvent } from 'react';

export function useDocumentListener<Type extends keyof DocumentEventMap>(
  type: Type,
  listener: (event: DocumentEventMap[Type]) => void,
  active = true,
): void {
  const listen = useEffectEvent(listener);

  useEffect(() => {
    if (!active) {
      return;
    }

    const handle = (event: DocumentEventMap[Type]) => listen(event);
    document.addEventListener(type, handle);

    return () => document.removeEventListener(type, handle);
  }, [type, active]);
}
