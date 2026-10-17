import { formatImage } from '@/lib/run';

export function RunImage({ image }: { image: string | null }) {
  if (!image) {
    return null;
  }

  return (
    <p className="mt-2 text-center text-muted-foreground text-xs">
      Ran in{' '}
      <span className="font-mono" title={image}>
        {formatImage(image)}
      </span>
    </p>
  );
}
