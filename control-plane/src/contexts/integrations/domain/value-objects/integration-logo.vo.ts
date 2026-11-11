import { InvalidIntegrationPartError } from '@integrations/domain/exceptions/invalid-integration-part.error';

const MAX_LENGTH = 65_536;
const DATA_IMAGE =
  /^data:image\/(?:svg\+xml|png|webp|jpeg);base64,[A-Za-z0-9+/]+={0,2}$/;

const isSecureAddress = (raw: string): boolean => {
  try {
    return new URL(raw).protocol === 'https:';
  } catch {
    return false;
  }
};

export class IntegrationLogo {
  private readonly kind = 'integration-logo';

  static readonly SHAPE = `is a base64 data URI of an SVG, PNG, WebP or JPEG image, or an https address, in at most ${MAX_LENGTH} characters`;

  private constructor(readonly value: string) {}

  static isLogo(raw: string): boolean {
    return (
      raw.length <= MAX_LENGTH && (DATA_IMAGE.test(raw) || isSecureAddress(raw))
    );
  }

  static of(raw: string): IntegrationLogo {
    if (!IntegrationLogo.isLogo(raw)) {
      throw new InvalidIntegrationPartError('logo', IntegrationLogo.SHAPE);
    }

    return new IntegrationLogo(raw);
  }

  equals(other: IntegrationLogo): boolean {
    return this.kind === other.kind && this.value === other.value;
  }
}
