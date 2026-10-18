import {
  applyDecorators,
  Controller,
  HttpStatus,
  UseFilters,
  UseInterceptors,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiExtraModels,
  ApiHeader,
  ApiResponse,
  ApiTags,
  getSchemaPath,
} from '@nestjs/swagger';
import { AllowWorkspaceTokens } from '@platform/http/decorators/allow-workspace-tokens.decorator';
import { ProblemResponseDto } from '@platform/http/dto/problem.response.dto';
import { ProblemFilter } from '@platform/http/resources/problem.filter';
import { ResourceInterceptor } from '@platform/http/resources/resource.interceptor';
import {
  API_VERSION,
  API_VERSION_HEADER,
  CLIENT_HEADER,
  PROBLEM_CONTENT_TYPE,
  SUPPORTED_API_VERSIONS,
} from '@platform/http/resources/resource-headers';

export const operationIdOf = (verb: string, kind: string): string =>
  [
    verb,
    ...kind
      .split('-')
      .map((each) => each.charAt(0).toUpperCase() + each.slice(1)),
  ].join('');

export const ApiProblemResponse = (status: number, description: string) =>
  ApiResponse({
    status,
    description,
    content: {
      [PROBLEM_CONTENT_TYPE]: {
        schema: { $ref: getSchemaPath(ProblemResponseDto) },
      },
    },
  });

export const ConventionalApiController = (path: string, tag: string) =>
  applyDecorators(
    Controller(path),
    ApiTags(tag),
    ApiExtraModels(ProblemResponseDto),
    UseFilters(ProblemFilter),
    UseInterceptors(ResourceInterceptor),
    AllowWorkspaceTokens(),
    ApiBearerAuth(),
    ApiHeader({
      name: API_VERSION_HEADER,
      required: false,
      description:
        'The API version the client was written against; every response names the version that it uses',
      schema: {
        type: 'string',
        enum: [...SUPPORTED_API_VERSIONS],
        default: API_VERSION,
      },
    }),
    ApiHeader({
      name: CLIENT_HEADER,
      required: false,
      description:
        'Who is calling, recorded against every configuration change: terraform-provider/<version>, cli/<version> or web; anything else is recorded as unknown',
      schema: { type: 'string', example: 'terraform-provider/0.1.0' },
    }),
    ApiProblemResponse(
      HttpStatus.BAD_REQUEST,
      'Malformed, or requests an API version this server does not serve',
    ),
    ApiProblemResponse(HttpStatus.UNAUTHORIZED, 'No valid credentials'),
  );
