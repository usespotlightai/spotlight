import {
  applyDecorators,
  BadRequestException,
  type Type,
} from '@nestjs/common';
import { ApiProperty, ApiQuery } from '@nestjs/swagger';
import {
  decodeCursor,
  LONGEST_PAGE,
  PAGE_LIMIT,
  type Page,
  type PageRequest,
} from '@shared-kernel/application/dto/page.dto';

export const ApiPageQuery = () =>
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
  );

export const pageRequestOf = (
  before: string | undefined,
  limit: string | undefined,
  keyed: (key: string) => boolean = () => true,
): PageRequest => {
  const cursor = before ? decodeCursor(before) : null;

  if (before && !(cursor && keyed(cursor.key))) {
    throw new BadRequestException('Sorry, the page cursor is not valid.');
  }

  const asked = limit === undefined ? PAGE_LIMIT : Number(limit);

  if (!Number.isInteger(asked) || asked < 1) {
    throw new BadRequestException(
      'Sorry, the page limit must be a whole number above 0.',
    );
  }

  return { before: cursor, limit: Math.min(asked, LONGEST_PAGE) };
};

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
