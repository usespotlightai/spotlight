import { useEffect, useState } from 'react';

export function useObjectUrl(file: Blob): string | null {
  const [url, setUrl] = useState<string | null>(null);

  useEffect(() => {
    const made = URL.createObjectURL(file);
    // react-doctor-disable-next-line react-hooks-js/set-state-in-effect
    setUrl(made);

    return () => URL.revokeObjectURL(made);
  }, [file]);

  return url;
}
