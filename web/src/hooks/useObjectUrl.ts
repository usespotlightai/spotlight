import { useEffect, useState } from 'react';

export function useObjectUrl(file: Blob | null): string | null {
  const [url, setUrl] = useState<string | null>(null);

  useEffect(() => {
    if (!file) {
      // react-doctor-disable-next-line react-hooks-js/set-state-in-effect
      setUrl(null); // oxlint-disable-line react/set-state-in-effect -- forgets the URL of a file that is gone
      return;
    }

    const made = URL.createObjectURL(file);
    // react-doctor-disable-next-line react-hooks-js/set-state-in-effect
    setUrl(made);

    return () => URL.revokeObjectURL(made);
  }, [file]);

  return url;
}
