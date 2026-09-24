import {
  applyDecorators,
  Controller,
  HttpStatus,
  UseFilters,
  UseInterceptors,
} from '@nestjs/common';
import {
  ApiExtraModels,
  ApiHeader,
  ApiResponse,
  ApiTags,
  getSchemaPath,
} from '@nestjs/swagger';
import { ProblemResponseDto } from '@platform/http/dto/problem.response.dto';
import { ProblemFilter } from '@platform/http/resources/problem.filter';
import { ResourceInterceptor } from '@platform/http/resources/resource.interceptor';
import {
  API_VERSION,
  API_VERSION_HEADER,
  PROBLEM_CONTENT_TYPE,
  SUPPORTED_API_VERSIONS,
} from '@platform/http/resources/resource-headers';

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
    ApiHeader({
      name: API_VERSION_HEADER,
      required: false,
      description:
        'The API version the client was written against; every response names the version it was answered in',
      schema: {
        type: 'string',
        enum: [...SUPPORTED_API_VERSIONS],
        default: API_VERSION,
      },
    }),
    ApiProblemResponse(
      HttpStatus.BAD_REQUEST,
      'Malformed, or asking for an API version this server does not serve',
    ),
    ApiProblemResponse(HttpStatus.UNAUTHORIZED, 'No valid credentials'),
  );
