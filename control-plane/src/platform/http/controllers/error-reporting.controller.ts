import { Controller, Get, Inject } from '@nestjs/common';
import { ApiOkResponse, ApiOperation, ApiTags } from '@nestjs/swagger';
import { ENV } from '@platform/config/config.constants';
import type { Env } from '@platform/config/env.schema';
import { AllowAnonymous } from '@platform/http/decorators/allow-anonymous.decorator';
import { InAudience } from '@platform/http/decorators/in-audience.decorator';
import { ErrorReportingResponseDto } from '@platform/http/dto/error-reporting.response.dto';

@ApiTags('error-reporting')
@InAudience('web')
@Controller('error-reporting')
export class ErrorReportingController {
  constructor(@Inject(ENV) private readonly env: Env) {}

  @Get()
  @AllowAnonymous()
  @ApiOperation({
    operationId: 'getErrorReporting',
    summary: 'Where the web app reports its errors, if anywhere',
  })
  @ApiOkResponse({ type: ErrorReportingResponseDto })
  handle(): ErrorReportingResponseDto {
    const dsn = this.env.SENTRY_WEB_DSN || this.env.SENTRY_DSN || null;

    return new ErrorReportingResponseDto(
      dsn,
      dsn ? this.env.SENTRY_ENVIRONMENT || null : null,
      dsn ? this.env.SPOTLIGHT_RELEASE || null : null,
    );
  }
}
