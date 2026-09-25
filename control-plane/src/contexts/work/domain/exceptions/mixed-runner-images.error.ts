export class MixedRunnerImagesError extends Error {
  readonly violation = 'invalid' as const;

  constructor(images: readonly string[]) {
    super(
      `A line's repositories name ${images.join(' and ')}, but a line runs every station in one image`,
    );
    this.name = 'MixedRunnerImagesError';
  }
}
