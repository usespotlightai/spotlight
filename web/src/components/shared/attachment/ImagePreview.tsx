import { useState } from 'react';

import { MissingImage } from '@/components/shared/attachment/MissingImage';
import { ZoomableImage } from '@/components/shared/attachment/ZoomableImage';
import { useObjectUrl } from '@/hooks/useObjectUrl';
import type { ImageSource } from '@/lib/attachment';

type ImagePreviewProps = {
  source: ImageSource;
  name: string;
  className?: string;
};

export function ImagePreview({ source, name, className }: ImagePreviewProps) {
  const local = useObjectUrl('blob' in source ? source.blob : null);
  const url = 'url' in source ? source.url : local;
  const [failed, setFailed] = useState<string | null>(null);

  if (url && failed === url) {
    return <MissingImage name={name} />;
  }

  return url ? (
    <ZoomableImage
      src={url}
      name={name}
      loading="lazy"
      className={className}
      onError={() => setFailed(url)}
    />
  ) : null;
}
