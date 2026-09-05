import {
  INSTALLER_ASSETS,
  type InstallerAssetsPort,
} from '@application/ports/installer-assets.port';
import { Controller, Get, Inject, Res } from '@nestjs/common';
import { ApiExcludeController } from '@nestjs/swagger';
import { AllowAnonymous } from '@presentation/http/decorators/allow-anonymous.decorator';

interface Sending {
  setHeader(name: string, value: string): void;
  end(chunk: string): void;
}

@ApiExcludeController()
@Controller()
export class InstallController {
  constructor(
    @Inject(INSTALLER_ASSETS) private readonly assets: InstallerAssetsPort,
  ) {}

  @Get('install.sh')
  @AllowAnonymous()
  script(@Res() response: Sending): void {
    response.setHeader('Content-Type', 'text/x-shellscript; charset=utf-8');
    response.setHeader('Cache-Control', 'no-store');
    response.end(this.assets.script());
  }
}
