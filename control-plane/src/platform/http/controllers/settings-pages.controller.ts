import { Controller, Get, Inject } from '@nestjs/common';
import { ApiOkResponse, ApiOperation, ApiTags } from '@nestjs/swagger';
import { ENV } from '@platform/config/config.constants';
import type { Env } from '@platform/config/env.schema';
import { InAudience } from '@platform/http/decorators/in-audience.decorator';
import { SettingsPagesResponseDto } from '@platform/http/dto/settings-pages.response.dto';

// The pages that SPOTLIGHT_SETTINGS_PAGES adds to the settings of the web app. Only the deployment sets them, never a workspace, because each page runs a script in the web app as the person who opens it.
@ApiTags('settings-pages')
@InAudience('web')
@Controller('settings-pages')
export class SettingsPagesController {
  constructor(@Inject(ENV) private readonly env: Env) {}

  @Get()
  @ApiOperation({
    operationId: 'listSettingsPages',
    summary: 'The pages that this deployment adds to the settings',
  })
  @ApiOkResponse({ type: SettingsPagesResponseDto })
  handle(): SettingsPagesResponseDto {
    return new SettingsPagesResponseDto(this.env.SPOTLIGHT_SETTINGS_PAGES);
  }
}
