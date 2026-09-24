import { ApiProperty } from '@nestjs/swagger';

export class ExchangeWorkloadTokenRequestDto {
  @ApiProperty({
    example: '0d6f3c1e-8a52-4f7b-9c1d-5e2a7b3f9c40',
    description: 'The id of the runner trust to enrol through',
  })
  readonly trust!: string;

  @ApiProperty({
    example: 'eyJhbGciOiJSUzI1NiIs…',
    description:
      'The OIDC token the platform issued this workload, such as a projected Kubernetes service account token',
  })
  readonly token!: string;

  @ApiProperty({
    example: 'runner-7c9f5d-x2k8q',
    description:
      'What to call the runner; exchanging again under the same name issues it a new token',
  })
  readonly name!: string;
}
