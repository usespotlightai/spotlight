import {
  applyDecorators,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Post,
  Put,
  type Type,
  UseFilters,
  UseInterceptors,
} from '@nestjs/common';
import {
  ApiExtension,
  ApiExtraModels,
  ApiHeader,
  ApiOperation,
  ApiQuery,
  ApiResponse,
  ApiTags,
  getSchemaPath,
} from '@nestjs/swagger';
import { ProblemResponseDto } from '@platform/http/dto/problem.response.dto';
import type { ResourceResponseDto } from '@platform/http/dto/resource.response.dto';
import { ProblemFilter } from '@platform/http/resources/problem.filter';
import { ResourceInterceptor } from '@platform/http/resources/resource.interceptor';
import {
  API_VERSION,
  API_VERSION_HEADER,
  ETAG_HEADER,
  IDEMPOTENCY_KEY_HEADER,
  IDEMPOTENT_REPLAY_HEADER,
  IF_MATCH_HEADER,
  PROBLEM_CONTENT_TYPE,
  RESOURCE_EXTENSION,
  SUPPORTED_API_VERSIONS,
} from '@platform/http/resources/resource-headers';
import { RESOURCES } from '@platform/http/routes';

export const RESOURCE_OPERATIONS = [
  'create',
  'read',
  'update',
  'delete',
  'import',
] as const;

export type ResourceOperation = (typeof RESOURCE_OPERATIONS)[number];

export interface ResourceKind {
  readonly kind: string;
  readonly tag: string;
  readonly representation: Type<ResourceResponseDto>;
  readonly addressExample: string;
}

const problem = (status: number, description: string) =>
  ApiResponse({
    status,
    description,
    content: {
      [PROBLEM_CONTENT_TYPE]: {
        schema: { $ref: getSchemaPath(ProblemResponseDto) },
      },
    },
  });

const ETAG = {
  [ETAG_HEADER]: {
    description: 'The version answered, to send back as If-Match',
    schema: { type: 'string', example: '"3"' },
  },
};

const IF_MATCH = ApiHeader({
  name: IF_MATCH_HEADER,
  required: true,
  description:
    'The ETag of the version this write was based on; a write to any other version is refused with 409',
  schema: { type: 'string', example: '"3"' },
});

const capitalised = (word: string): string =>
  word
    .split('-')
    .map((each) => each.charAt(0).toUpperCase() + each.slice(1))
    .join('');

export const resourceApi = (resource: ResourceKind) => {
  const operation = (name: ResourceOperation, summary: string) =>
    applyDecorators(
      ApiOperation({
        operationId: `${name}${capitalised(resource.kind)}`,
        summary,
      }),
      ApiExtension(RESOURCE_EXTENSION, {
        kind: resource.kind,
        operation: name,
      }),
    );

  const answered = (status: number, description: string) =>
    ApiResponse({
      status,
      description,
      type: resource.representation,
      headers: ETAG,
    });

  const missing = problem(
    HttpStatus.NOT_FOUND,
    `No such ${resource.kind} that you may see`,
  );

  return {
    Controller: () =>
      applyDecorators(
        Controller(RESOURCES),
        ApiTags(resource.tag),
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
        problem(
          HttpStatus.BAD_REQUEST,
          'Malformed, or asking for an API version this server does not serve',
        ),
        problem(HttpStatus.UNAUTHORIZED, 'No valid credentials'),
      ),

    Create: (path: string, summary: string) =>
      applyDecorators(
        Post(path),
        HttpCode(HttpStatus.CREATED),
        operation('create', summary),
        ApiHeader({
          name: IDEMPOTENCY_KEY_HEADER,
          required: true,
          description:
            'Unique per create; a retry with the same key and body answers the resource the first attempt created, and creates nothing more',
          schema: { type: 'string', maxLength: 255 },
        }),
        ApiResponse({
          status: HttpStatus.CREATED,
          description: `The ${resource.kind}, as a read would answer it`,
          type: resource.representation,
          headers: {
            ...ETAG,
            [IDEMPOTENT_REPLAY_HEADER]: {
              description: 'true when this answers an earlier attempt',
              schema: { type: 'string', enum: ['true'] },
            },
          },
        }),
        missing,
        problem(
          HttpStatus.CONFLICT,
          `There is already a ${resource.kind} at that address`,
        ),
        problem(
          HttpStatus.UNPROCESSABLE_ENTITY,
          'What is wrong, field by field; or the Idempotency-Key was used for a different request',
        ),
      ),

    Read: (path: string, summary: string) =>
      applyDecorators(
        Get(path),
        operation('read', summary),
        answered(HttpStatus.OK, `The ${resource.kind}, every field of it`),
        missing,
      ),

    Update: (path: string, summary: string) =>
      applyDecorators(
        Put(path),
        operation('update', summary),
        IF_MATCH,
        answered(
          HttpStatus.OK,
          `The ${resource.kind}, as a read would answer it`,
        ),
        missing,
        problem(
          HttpStatus.CONFLICT,
          'It changed since the version in If-Match, and currentVersion says where it is; or something else still uses what this would remove',
        ),
        problem(
          HttpStatus.UNPROCESSABLE_ENTITY,
          'What is wrong, field by field',
        ),
        problem(HttpStatus.PRECONDITION_REQUIRED, 'If-Match is missing'),
      ),

    Delete: (path: string, summary: string) =>
      applyDecorators(
        Delete(path),
        HttpCode(HttpStatus.NO_CONTENT),
        operation('delete', summary),
        IF_MATCH,
        ApiResponse({ status: HttpStatus.NO_CONTENT, description: 'Deleted' }),
        missing,
        problem(
          HttpStatus.CONFLICT,
          'It changed since the version in If-Match, and currentVersion says where it is; or something else still uses what this would remove',
        ),
        problem(HttpStatus.PRECONDITION_REQUIRED, 'If-Match is missing'),
      ),

    Import: (path: string, summary: string) =>
      applyDecorators(
        Get(path),
        operation('import', summary),
        ApiQuery({
          name: 'address',
          required: true,
          description: `The ${resource.kind}'s address within the workspace`,
          example: resource.addressExample,
        }),
        answered(
          HttpStatus.OK,
          `The ${resource.kind}, as a read would answer it`,
        ),
        missing,
      ),
  };
};
