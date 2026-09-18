import { Controller, Get, NotFoundException, Param } from '@nestjs/common';
import { QueryBus } from '@nestjs/cqrs';
import {
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiOperation,
  ApiParam,
  ApiTags,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';
import { CurrentUser } from '@platform/http/decorators/current-user.decorator';
import type { AuthenticatedUser } from '@shared-kernel/application/ports/session.port';
import type { HarnessDto } from '@work/application/dto/harness.dto';
import { ListHarnessesQuery } from '@work/application/queries/list-harnesses.query';
import {
  HarnessModelResponseDto,
  HarnessResponseDto,
} from '@work/presentation/http/dto/harness.response.dto';

@ApiTags('harnesses')
@ApiUnauthorizedResponse({ description: 'No valid session' })
@ApiParam({ name: 'slug', example: 'acme' })
@Controller('workspaces/:slug/harnesses')
export class HarnessController {
  constructor(private readonly queryBus: QueryBus) {}

  @Get()
  @ApiOperation({
    operationId: 'listHarnesses',
    summary: 'List the harnesses a station can be worked by',
  })
  @ApiOkResponse({ type: HarnessResponseDto, isArray: true })
  @ApiNotFoundResponse({ description: 'No such workspace for this caller' })
  async list(
    @Param('slug') slug: string,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<HarnessResponseDto[]> {
    const harnesses = await this.queryBus.execute<
      ListHarnessesQuery,
      HarnessDto[] | null
    >(new ListHarnessesQuery(slug, user.id));

    if (!harnesses) {
      throw new NotFoundException();
    }

    return harnesses.map(
      (harness) =>
        new HarnessResponseDto(
          harness.id,
          harness.name,
          harness.models.map(
            (model) => new HarnessModelResponseDto(model.id, model.name),
          ),
          harness.defaultModel,
          harness.efforts,
        ),
    );
  }
}
