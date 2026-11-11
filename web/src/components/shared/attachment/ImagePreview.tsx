import { useParams } from 'react-router';
import { ZoomableImage } from '@/components/shared/attachment/ZoomableImage';
import { useObjectUrl } from '@/hooks/useObjectUrl';
import { attachmentPath } from '@/lib/attachment';

type ImagePreviewProps = {
  image: Blob;
  name: string;
  storedId?: string;
  className?: string;
};

export function ImagePreview({
  image,
  name,
  storedId,
  className,
}: ImagePreviewProps) {
  const { slug } = useParams();
  const stored = slug && storedId ? attachmentPath(slug, storedId) : null;
  const local = useObjectUrl(stored ? null : image);
  const url = stored ?? local;

  return url ? (
    <ZoomableImage src={url} name={name} className={className} />
  ) : null;
}
