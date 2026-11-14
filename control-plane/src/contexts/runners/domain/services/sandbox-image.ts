import type { RunnerImage } from '@shared-kernel/domain/value-objects/runner-image.vo';

export interface NamedHostImage {
  readonly image: RunnerImage;
  readonly digest: RunnerImage | null;
  readonly isDefault: boolean;
}

const namedOn = (
  host: readonly NamedHostImage[],
  image: RunnerImage,
): RunnerImage =>
  host.find(
    (each) => each.image.equals(image) || (each.digest?.equals(image) ?? false),
  )?.image ?? image;

export const sandboxImage = (
  sandbox:
    | { readonly warm: true; readonly placement: RunnerImage | null }
    | { readonly warm: false; readonly lastRanIn: RunnerImage | null },
  host: readonly NamedHostImage[],
): RunnerImage | null => {
  const image = sandbox.warm
    ? (sandbox.placement ?? host.find((each) => each.isDefault)?.image ?? null)
    : sandbox.lastRanIn;

  return image === null ? null : namedOn(host, image);
};
