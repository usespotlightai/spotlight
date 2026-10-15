import { ApiProperty } from '@nestjs/swagger';

export class ErrorReportingResponseDto {
  @ApiProperty({
    nullable: true,
    type: String,
    description:
      'The Sentry DSN of the web app. Null when errors are not reported.',
  })
  readonly dsn: string | null;

  @ApiProperty({ nullable: true, type: String, example: 'production' })
  readonly environment: string | null;

  @ApiProperty({ nullable: true, type: String, example: 'v1.4.0' })
  readonly release: string | null;

  constructor(
    dsn: string | null,
    environment: string | null,
    release: string | null,
  ) {
    this.dsn = dsn;
    this.environment = environment;
    this.release = release;
  }
}
