import {
  applyDecorators,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Post,
  Put,
  type Type,
} from '@nestjs/common';
import {
  ApiExtension,
  ApiHeader,
  ApiOperation,
  ApiQuery,
  ApiResponse,
} from '@nestjs/swagger';
import type { ResourceResponseDto } from '@platform/http/dto/resource.response.dto';
import { resourceListOf } from '@platform/http/dto/resource-list.response.dto';
import {
  ApiProblemResponse,
  ConventionalApiController,
  operationIdOf,
} from '@platform/http/resources/conventional-api';
import {
  ETAG_HEADER,
  IDEMPOTENCY_KEY_HEADER,
  IDEMPOTENT_REPLAY_HEADER,
  IF_MATCH_HEADER,
  RESOURCE_EXTENSION,
} from '@platform/http/resources/resource-headers';
import { RESOURCES } from '@platform/http/routes';

export const RESOURCE_OPERATIONS = [
  'create',
  'read',
  'update',
  'delete',
  'import',
  'list',
] as const;

export type ResourceOperation = (typeof RESOURCE_OPERATIONS)[number];

export interface ResourceKind {
  readonly kind: string;
  readonly plural: string;
  readonly tag: string;
  readonly representation: Type<ResourceResponseDto>;
  readonly addressExample: string;
}

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

export const resourceApi = (resource: ResourceKind) => {
  const operation = (name: ResourceOperation, summary: string) =>
    applyDecorators(
      ApiOperation({
        operationId: operationIdOf(
          name,
          name === 'list' ? resource.plural : resource.kind,
        ),
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

  const missing = ApiProblemResponse(
    HttpStatus.NOT_FOUND,
    `No such ${resource.kind} that you may see`,
  );

  const listed = ApiResponse({
    status: HttpStatus.OK,
    description: `Every ${resource.kind} there, each as a read would answer it, in address order`,
    type: resourceListOf(resource.representation),
  });

  const forbidden = ApiProblemResponse(
    HttpStatus.FORBIDDEN,
    `Not allowed to do this to the ${resource.kind}: your role in its workspace or your token’s scopes fall short, or only a person may do it; the detail says which`,
  );

  return {
    Controller: () => ConventionalApiController(RESOURCES, resource.tag),

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
        forbidden,
        ApiProblemResponse(
          HttpStatus.CONFLICT,
          `There is already a ${resource.kind} at that address`,
        ),
        ApiProblemResponse(
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
        forbidden,
        ApiProblemResponse(
          HttpStatus.CONFLICT,
          'It changed since the version in If-Match, and currentVersion says where it is; or something else still uses what this would remove',
        ),
        ApiProblemResponse(
          HttpStatus.UNPROCESSABLE_ENTITY,
          'What is wrong, field by field',
        ),
        ApiProblemResponse(
          HttpStatus.PRECONDITION_REQUIRED,
          'If-Match is missing',
        ),
      ),

    Delete: (path: string, summary: string) =>
      applyDecorators(
        Delete(path),
        HttpCode(HttpStatus.NO_CONTENT),
        operation('delete', summary),
        IF_MATCH,
        ApiResponse({ status: HttpStatus.NO_CONTENT, description: 'Deleted' }),
        missing,
        forbidden,
        ApiProblemResponse(
          HttpStatus.CONFLICT,
          'It changed since the version in If-Match, and currentVersion says where it is; or something else still uses what this would remove',
        ),
        ApiProblemResponse(
          HttpStatus.PRECONDITION_REQUIRED,
          'If-Match is missing',
        ),
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

    List: (path: string, summary: string) =>
      applyDecorators(
        Get(path),
        operation('list', summary),
        listed,
        ApiProblemResponse(
          HttpStatus.NOT_FOUND,
          'No such workspace that you may see',
        ),
      ),

    ListVisible: (path: string, summary: string) =>
      applyDecorators(Get(path), operation('list', summary), listed),
  };
};
