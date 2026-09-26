import { ApiProperty } from '@nestjs/swagger';

export class ExchangeWorkloadTokenRequestDto {
  @ApiProperty({
    example: '0d6f3c1e-8a52-4f7b-9c1d-5e2a7b3f9c40',
    description: 'The id of the workspace token trust to exchange through',
  })
  readonly trust!: string;

  @ApiProperty({
    example:
      'eyJhbGciOiJSUzI1NiIsImtpZCI6IjEifQ.eyJzdWIiOiJyZXBvOmFjbWUvcGxhdGZvcm0ifQ.c2ln',
    description:
      'The OIDC token the CI platform issued the workload, for the trust’s audience',
  })
  readonly token!: string;
}
