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
import type { AuthenticatedUser } from '@platform/http/authenticated-user';
import { CurrentUser } from '@platform/http/decorators/current-user.decorator';
import type { HarnessDto } from '@runs/application/dto/harness.dto';
import { ListHarnessesQuery } from '@runs/application/queries/list-harnesses.query';
import {
  HarnessModelResponseDto,
  HarnessResponseDto,
} from '@runs/presentation/http/dto/harness.response.dto';

@ApiTags('harnesses')
@ApiUnauthorizedResponse({ description: 'No valid session' })
@ApiParam({ name: 'slug', example: 'acme' })
@Controller('workspaces/:slug/harnesses')
export class HarnessController {
  constructor(private readonly queryBus: QueryBus) {}

  @Get()
  @ApiOperation({
    operationId: 'listHarnesses',
    summary: 'List the harnesses a run can use',
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
