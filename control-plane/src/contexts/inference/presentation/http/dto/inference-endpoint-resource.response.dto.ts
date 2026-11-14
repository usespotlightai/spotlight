import type { InferenceEndpointResourceDto } from '@inference/application/dto/inference-endpoint-resource.dto';
import { ApiProperty } from '@nestjs/swagger';
import { ResourceResponseDto } from '@platform/http/dto/resource.response.dto';

export class InferenceEndpointResourceResponseDto extends ResourceResponseDto {
  @ApiProperty({
    example: '5b1e9d2c-7a43-4f8e-b6c0-3d9a8e1f2b57',
    description: 'The workspace it belongs to',
  })
  readonly workspaceId: string;

  @ApiProperty({
    example: 'https://openrouter.ai/api/v1',
    description:
      'The base URL of an OpenAI-compatible API. Spotlight calls its /chat/completions',
  })
  readonly baseUrl: string;

  @ApiProperty({
    example: 'openai/gpt-5-mini',
    description: 'The one model every Spotlight feature of the workspace uses',
  })
  readonly model: string;

  @ApiProperty({
    example: false,
    description: 'Whether the model accepts the reasoning_effort parameter',
  })
  readonly supportsReasoningEffort: boolean;

  @ApiProperty({
    example: true,
    description:
      'Whether Spotlight holds an API key. The key is write-only and never returned',
  })
  readonly apiKeySet: boolean;

  @ApiProperty({
    type: 'integer',
    nullable: true,
    example: 1,
    description:
      'Changed, with a new key, to rotate the API key, which is write-only and never returned',
  })
  readonly apiKeyVersion: number | null;

  constructor(endpoint: InferenceEndpointResourceDto) {
    super(endpoint);
    this.workspaceId = endpoint.workspaceId;
    this.baseUrl = endpoint.baseUrl;
    this.model = endpoint.model;
    this.supportsReasoningEffort = endpoint.supportsReasoningEffort;
    this.apiKeySet = endpoint.apiKeySet;
    this.apiKeyVersion = endpoint.apiKeyVersion;
  }
}

export class ConnectionTestResponseDto {
  @ApiProperty({
    example: true,
    description: 'Whether the endpoint answered a minimal request',
  })
  readonly ok: boolean;

  @ApiProperty({
    example: 'The endpoint answered.',
    description: 'What happened, to show to a person',
  })
  readonly message: string;

  constructor(ok: boolean, message: string) {
    this.ok = ok;
    this.message = message;
  }
}
