import { ZoomableImage } from '@/components/shared/attachment/ZoomableImage';
import { useObjectUrl } from '@/hooks/useObjectUrl';

type ImagePreviewProps = {
  image: Blob;
  name: string;
  className?: string;
};

export function ImagePreview({ image, name, className }: ImagePreviewProps) {
  const url = useObjectUrl(image);

  return url ? (
    <ZoomableImage src={url} name={name} className={className} />
  ) : null;
}
