import { useEffect, useState } from 'react';

export function useObjectUrl(file: Blob): string | null {
  const [url, setUrl] = useState<string | null>(null);

  useEffect(() => {
    const made = URL.createObjectURL(file);
    setUrl(made);

    return () => URL.revokeObjectURL(made);
  }, [file]);

  return url;
}
