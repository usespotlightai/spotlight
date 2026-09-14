import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import type { InstallerAssetsPort } from '@application/ports/installer-assets.port';
import { ENV } from '@infrastructure/config/config.constants';
import type { Env } from '@infrastructure/config/env.schema';
import { Inject, Injectable } from '@nestjs/common';

@Injectable()
export class InstallerAssets implements InstallerAssetsPort {
  constructor(@Inject(ENV) private readonly env: Env) {}

  script(): string {
    const template = readFileSync(
      join(this.env.SPOTLIGHT_INSTALLER_DIR, 'install.sh'),
      'utf8',
    );

    const apiBase = this.env.SPOTLIGHT_PUBLIC_URL ?? this.env.BETTER_AUTH_URL;

    return template.replaceAll('__API_BASE__', apiBase);
  }
}
