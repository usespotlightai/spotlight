export class MixedRunnerImagesError extends Error {
  readonly kind = 'invalid' as const;

  constructor(images: readonly string[]) {
    super(
      `Line repositories name different images (${images.join(', ')}). A line runs every station in one image.`,
    );
    this.name = 'MixedRunnerImagesError';
  }
}
