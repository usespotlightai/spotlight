import { HostImageRow } from '@/components/features/runners/HostImageRow';
import type { HostImageResponseDto } from '@/lib/api';
import { type NamedHarness, namedHarnesses } from '@/lib/runner';

type HostImagesProps = {
  images: readonly HostImageResponseDto[];
  harnesses: readonly NamedHarness[] | undefined;
};

export function HostImages({ images, harnesses }: HostImagesProps) {
  if (images.length === 0) {
    return null;
  }

  return (
    <ul aria-label="Runner images" className="flex flex-col gap-3">
      {images.map((image) => (
        <HostImageRow
          key={image.image}
          image={image}
          harnesses={namedHarnesses(image.harnesses, harnesses)}
        />
      ))}
    </ul>
  );
}
