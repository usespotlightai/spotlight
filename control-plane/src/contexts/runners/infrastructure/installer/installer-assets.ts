import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { Inject, Injectable } from '@nestjs/common';
import { ENV } from '@platform/config/config.constants';
import type { Env } from '@platform/config/env.schema';
import type { InstallerAssetsPort } from '@runners/application/ports/installer-assets.port';

@Injectable()
export class InstallerAssets implements InstallerAssetsPort {
  constructor(@Inject(ENV) private readonly env: Env) {}

  script(): string {
    const template = readFileSync(
      join(this.env.SPOTLIGHT_INSTALLER_DIR, 'install.sh'),
      'utf8',
    );

    const apiBase = this.env.SPOTLIGHT_PUBLIC_URL ?? this.env.BETTER_AUTH_URL;

    return template
      .replaceAll('__API_BASE__', apiBase)
      .replaceAll('__VERSION__', this.env.SPOTLIGHT_RELEASE || 'latest');
  }
}
