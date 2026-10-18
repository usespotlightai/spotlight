import type { Type } from '@nestjs/common';
import { ApiProperty } from '@nestjs/swagger';
import type { ResourceResponseDto } from '@platform/http/dto/resource.response.dto';

export interface ResourceList<R> {
  readonly items: readonly R[];
}

export const resourceListOf = (
  representation: Type<ResourceResponseDto>,
): Type<ResourceList<ResourceResponseDto>> => {
  class ResourceListResponseDto implements ResourceList<ResourceResponseDto> {
    @ApiProperty({
      type: representation,
      isArray: true,
      description:
        'Every one there is, each as a read returns it, in address order',
    })
    readonly items: readonly ResourceResponseDto[] = [];
  }

  Object.defineProperty(ResourceListResponseDto, 'name', {
    value: representation.name.replace(/ResponseDto$/, 'ListResponseDto'),
  });

  return ResourceListResponseDto;
};
