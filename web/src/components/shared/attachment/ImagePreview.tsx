import { useObjectUrl } from '@/hooks/useObjectUrl';

type ImagePreviewProps = {
  image: Blob;
  alt: string;
  className?: string;
};

export function ImagePreview({ image, alt, className }: ImagePreviewProps) {
  const url = useObjectUrl(image);

  return url ? <img src={url} alt={alt} className={className} /> : null;
}
