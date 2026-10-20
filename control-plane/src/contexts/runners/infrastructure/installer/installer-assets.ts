import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { Inject, Injectable } from '@nestjs/common';
import { ENV } from '@platform/config/config.constants';
import { publicUrlOf } from '@platform/config/env';
import type { Env } from '@platform/config/env.schema';
import type { InstallerAssetsPort } from '@runners/application/ports/installer-assets.port';
import { Release } from '@shared-kernel/domain/value-objects/release.vo';

@Injectable()
export class InstallerAssets implements InstallerAssetsPort {
  constructor(@Inject(ENV) private readonly env: Env) {}

  script(): string {
    const template = readFileSync(
      join(this.env.SPOTLIGHT_INSTALLER_DIR, 'install.sh'),
      'utf8',
    );

    return template
      .replaceAll('__API_BASE__', publicUrlOf(this.env))
      .replaceAll(
        '__VERSION__',
        Release.published(this.env.SPOTLIGHT_RELEASE ?? null)?.value ??
          'latest',
      );
  }
}
