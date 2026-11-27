import { applyDecorators, type Type } from '@nestjs/common';
import {
  ApiBadRequestResponse,
  ApiProperty,
  ApiQuery,
  ApiUnprocessableEntityResponse,
} from '@nestjs/swagger';
import { pageLimitOf } from '@platform/http/page-limit';
import {
  LONGEST_PAGE,
  PAGE_LIMIT,
} from '@shared-kernel/application/dto/page.dto';
import type { Page } from '@shared-kernel/application/dto/page.dto';
import type { PageRequest } from '@work/application/dto/page.dto';

export const ApiPageQuery = (): ReturnType<typeof applyDecorators> =>
  applyDecorators(
    ApiQuery({
      name: 'before',
      required: false,
      type: String,
      description: 'The `next` cursor of the page before',
    }),
    ApiQuery({
      name: 'limit',
      required: false,
      type: Number,
      description: `At most this many, ${PAGE_LIMIT} by default, up to ${LONGEST_PAGE}`,
    }),
    ApiBadRequestResponse({
      description: 'A page limit that is not a whole number above 0',
    }),
    ApiUnprocessableEntityResponse({
      description: 'A page cursor that this list did not give',
    }),
  );

export const pageRequestOf = (
  before: string | undefined,
  limit: string | undefined,
): PageRequest => ({
  before: before === undefined || before === '' ? null : before,
  limit: pageLimitOf(limit),
});

export const pageResponseOf = <R>(representation: Type<R>): Type<Page<R>> => {
  class PageResponseDto implements Page<R> {
    @ApiProperty({ type: representation, isArray: true })
    readonly items: readonly R[] = [];

    @ApiProperty({
      type: String,
      nullable: true,
      description: 'Pass as `before` to read the next page; null on the last',
    })
    readonly next: string | null = null;
  }

  Object.defineProperty(PageResponseDto, 'name', {
    value: representation.name.replace(/ResponseDto$/, 'PageResponseDto'),
  });

  return PageResponseDto;
};
