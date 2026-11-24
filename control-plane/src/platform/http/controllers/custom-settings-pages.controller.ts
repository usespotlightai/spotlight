import { Controller, Get, Inject } from '@nestjs/common';
import { ApiOkResponse, ApiOperation, ApiTags } from '@nestjs/swagger';
import { ENV } from '@platform/config/config.constants';
import type { Env } from '@platform/config/env.schema';
import { InAudience } from '@platform/http/decorators/in-audience.decorator';
import { CustomSettingsPagesResponseDto } from '@platform/http/dto/custom-settings-pages.response.dto';

// The pages that SPOTLIGHT_CUSTOM_SETTINGS_PAGES adds to the settings of the web app. Only the deployment sets them, never a workspace, because each page runs a script in the web app as the person who opens it.
@ApiTags('custom-settings-pages')
@InAudience('web')
@Controller('custom-settings-pages')
export class CustomSettingsPagesController {
  constructor(@Inject(ENV) private readonly env: Env) {}

  @Get()
  @ApiOperation({
    operationId: 'listCustomSettingsPages',
    summary: 'The pages that this deployment adds to the settings',
  })
  @ApiOkResponse({ type: CustomSettingsPagesResponseDto })
  handle(): CustomSettingsPagesResponseDto {
    return new CustomSettingsPagesResponseDto(
      this.env.SPOTLIGHT_CUSTOM_SETTINGS_PAGES,
    );
  }
}
