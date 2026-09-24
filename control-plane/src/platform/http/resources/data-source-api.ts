import { applyDecorators, Get, HttpStatus, type Type } from '@nestjs/common';
import {
  ApiExtension,
  ApiOperation,
  ApiQuery,
  ApiResponse,
} from '@nestjs/swagger';
import {
  ApiProblemResponse,
  ConventionalApiController,
  operationIdOf,
} from '@platform/http/resources/conventional-api';
import { DATA_SOURCE_EXTENSION } from '@platform/http/resources/resource-headers';
import { RESOURCES } from '@platform/http/routes';

export interface DataSourceQuery {
  readonly name: string;
  readonly description: string;
  readonly example: string;
}

export interface DataSourceKind {
  readonly kind: string;
  readonly tag: string;
  readonly representation: Type<unknown>;
  readonly query: readonly DataSourceQuery[];
}

export const dataSourceApi = (source: DataSourceKind) => ({
  Controller: () => ConventionalApiController(RESOURCES, source.tag),

  Read: (path: string, summary: string) =>
    applyDecorators(
      Get(path),
      ApiOperation({
        operationId: operationIdOf('read', source.kind),
        summary,
      }),
      ApiExtension(DATA_SOURCE_EXTENSION, { kind: source.kind }),
      ...source.query.map((each) =>
        ApiQuery({
          name: each.name,
          required: true,
          description: each.description,
          example: each.example,
        }),
      ),
      ApiResponse({
        status: HttpStatus.OK,
        description: `The ${source.kind} it resolves to`,
        type: source.representation,
      }),
      ApiProblemResponse(
        HttpStatus.NOT_FOUND,
        `No such ${source.kind}, or no workspace here that you may see`,
      ),
      ApiProblemResponse(
        HttpStatus.UNPROCESSABLE_ENTITY,
        'What is wrong with the query, field by field',
      ),
    ),
});
