import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import type { TerraformProviderPinPort } from '@configuration/application/ports/terraform-provider-pin.port';

const PIN = join(__dirname, 'provider.tf');

const attributeIn = (pin: string, name: string): string => {
  const found = new RegExp(`^\\s*${name}\\s*=\\s*"([^"]+)"\\s*$`, 'm').exec(
    pin,
  )?.[1];

  if (found === undefined) {
    throw new Error(`The provider pin in ${PIN} has no ${name}`);
  }

  return found;
};

export class PinnedTerraformProvider implements TerraformProviderPinPort {
  readonly source: string;

  readonly version: string;

  constructor(pin: string = readFileSync(PIN, 'utf8')) {
    this.source = attributeIn(pin, 'source');
    this.version = attributeIn(pin, 'version');
  }
}
