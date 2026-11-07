import { DomainError } from '@shared-kernel/domain/exceptions/domain-error';

export class MixedRunnerImagesError extends DomainError {
  readonly kind = 'conflict' as const;

  constructor() {
    super(
      'The lines that name these repositories run in different images, so one chat cannot read them all. Please give the lines one image, or choose fewer repositories.',
    );
    this.name = 'MixedRunnerImagesError';
  }
}
