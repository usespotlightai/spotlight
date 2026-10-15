import type { ExpressionPositionDto } from '@integrations/application/dto/expression-check.dto';
import type { CheckedExpression } from '@integrations/application/ports/expression-checks.port';
import { CheckExpressionQuery } from '@integrations/application/queries/check-expression.query';
import { ListExpressionPositionsQuery } from '@integrations/application/queries/list-expression-positions.query';
import { CheckExpressionRequestDto } from '@integrations/presentation/http/dto/expression-check.request.dto';
import {
  ExpressionCheckResponseDto,
  ExpressionPositionResponseDto,
} from '@integrations/presentation/http/dto/expression-check.response.dto';
import { Body, Get, HttpCode, HttpStatus, Post } from '@nestjs/common';
import { QueryBus } from '@nestjs/cqrs';
import { ApiBody, ApiOkResponse, ApiOperation } from '@nestjs/swagger';
import { CurrentPrincipal } from '@platform/http/decorators/current-principal.decorator';
import {
  ApiProblemResponse,
  ConventionalApiController,
} from '@platform/http/resources/conventional-api';
import { ProblemException } from '@platform/http/resources/problem.exception';
import { EXPRESSIONS } from '@platform/http/routes';
import type { Forbidden } from '@shared-kernel/application/dto/resource-outcomes.dto';
import { ConfigurationProblem } from '@shared-kernel/domain/value-objects/configuration-problem.vo';
import { FieldPath } from '@shared-kernel/domain/value-objects/field-path.vo';
import type { Principal } from '@shared-kernel/domain/value-objects/principal.vo';

const REQUEST = 'request';

const POSITION = FieldPath.of(['position']);

const DEFINITION = FieldPath.of(['definition']);

const POSITION_WRITTEN =
  'names the attribute that holds the expression, as in integration.webhook.events[0].when';

const problemAt = (at: FieldPath, reason: string): ConfigurationProblem =>
  ConfigurationProblem.of({ path: '', at, reason });

const refusalOf = (
  checked: Exclude<CheckedExpression, { outcome: 'checked' }>,
): ConfigurationProblem[] => {
  switch (checked.outcome) {
    case 'invalid':
      return checked.problems.map((problem) =>
        problemAt(DEFINITION.to(...problem.field.segments), problem.reason),
      );
    case 'no-such-resource':
      return [
        problemAt(
          POSITION,
          'names an attribute of an integration or a hook, as in integration.webhook.events[0].when or hook.when',
        ),
      ];
    case 'no-expression-there':
      return [
        problemAt(
          POSITION,
          'holds no expression in the definition. Nothing is written there to check',
        ),
      ];
  }
};

@ConventionalApiController(EXPRESSIONS, 'expressions')
export class ExpressionCheckController {
  constructor(private readonly queryBus: QueryBus) {}

  @Post('check')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    operationId: 'checkExpression',
    summary: 'Type-check an expression where it is written, as a plan does',
  })
  @ApiBody({ type: CheckExpressionRequestDto })
  @ApiOkResponse({
    type: ExpressionCheckResponseDto,
    description: 'What it evaluates to, and anything wrong with it',
  })
  @ApiProblemResponse(
    HttpStatus.UNPROCESSABLE_ENTITY,
    'The request is not shaped as a check, the definition holds errors, each listed under definition, or the position names no expression in it',
  )
  @ApiProblemResponse(
    HttpStatus.FORBIDDEN,
    'A workspace token whose scopes do not let it plan',
  )
  async check(
    @Body() body: unknown,
    @CurrentPrincipal() principal: Principal,
  ): Promise<ExpressionCheckResponseDto> {
    const { position, expression, definition } = (body ?? {}) as Record<
      string,
      unknown
    >;
    const field =
      typeof position === 'string' ? FieldPath.parsed(position.trim()) : null;

    if (!field || typeof expression !== 'string') {
      throw ProblemException.invalid(REQUEST, [
        ...(field ? [] : [problemAt(POSITION, POSITION_WRITTEN)]),
        ...(typeof expression === 'string'
          ? []
          : [
              problemAt(
                FieldPath.of(['expression']),
                'is the CEL expression, as text',
              ),
            ]),
      ]);
    }

    const checked = await this.queryBus.execute<
      CheckExpressionQuery,
      CheckedExpression | Forbidden
    >(new CheckExpressionQuery(field, expression, definition, principal));

    if (checked.outcome === 'forbidden') {
      throw ProblemException.forbidden(REQUEST, checked.act);
    }

    if (checked.outcome !== 'checked') {
      throw ProblemException.invalid(REQUEST, refusalOf(checked));
    }

    return new ExpressionCheckResponseDto(checked.check);
  }

  @Get('positions')
  @ApiOperation({
    operationId: 'listExpressionPositions',
    summary: 'Every position an expression is written at, and what it sees',
  })
  @ApiOkResponse({ type: ExpressionPositionResponseDto, isArray: true })
  async positions(): Promise<ExpressionPositionResponseDto[]> {
    const positions = await this.queryBus.execute<
      ListExpressionPositionsQuery,
      readonly ExpressionPositionDto[]
    >(new ListExpressionPositionsQuery());

    return positions.map((each) => new ExpressionPositionResponseDto(each));
  }
}
