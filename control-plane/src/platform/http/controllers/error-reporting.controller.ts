import { Controller, Get, Inject } from '@nestjs/common';
import { ApiOkResponse, ApiOperation, ApiTags } from '@nestjs/swagger';
import { ENV } from '@platform/config/config.constants';
import type { Env } from '@platform/config/env.schema';
import { AllowAnonymous } from '@platform/http/decorators/allow-anonymous.decorator';
import { InAudience } from '@platform/http/decorators/in-audience.decorator';
import { ErrorReportingResponseDto } from '@platform/http/dto/error-reporting.response.dto';

const nonEmpty = (value: string | undefined): string | null =>
  value === undefined || value === '' ? null : value;

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
    const dsn =
      nonEmpty(this.env.SENTRY_WEB_DSN) ?? nonEmpty(this.env.SENTRY_DSN);

    return new ErrorReportingResponseDto(
      dsn,
      dsn === null ? null : nonEmpty(this.env.SENTRY_ENVIRONMENT),
      dsn === null ? null : nonEmpty(this.env.SPOTLIGHT_RELEASE),
    );
  }
}
