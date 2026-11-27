export const TERRAFORM_PROVIDER_PIN = Symbol('TERRAFORM_PROVIDER_PIN');

/** The Spotlight provider release that an export requires. */
export interface TerraformProviderPinPort {
  readonly source: string;
  readonly version: string;
}
