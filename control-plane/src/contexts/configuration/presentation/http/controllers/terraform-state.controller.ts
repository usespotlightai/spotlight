import { createHash } from 'node:crypto';
import { LockTerraformStateCommand } from '@configuration/application/commands/lock-terraform-state.command';
import { UnlockTerraformStateCommand } from '@configuration/application/commands/unlock-terraform-state.command';
import { WriteTerraformStateCommand } from '@configuration/application/commands/write-terraform-state.command';
import type {
  StateChanged,
  StateRead,
} from '@configuration/application/dto/terraform-state-outcomes.dto';
import { ReadTerraformStateQuery } from '@configuration/application/queries/read-terraform-state.query';
import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  ForbiddenException,
  Get,
  Headers,
  HttpStatus,
  NotFoundException,
  Param,
  Post,
  Query,
  Req,
  Res,
} from '@nestjs/common';
import { CommandBus, QueryBus } from '@nestjs/cqrs';
import { ApiExcludeController } from '@nestjs/swagger';
import { AllowBasicCredentials } from '@platform/http/decorators/allow-basic-credentials.decorator';
import { AllowWorkspaceTokens } from '@platform/http/decorators/allow-workspace-tokens.decorator';
import { CurrentActor } from '@platform/http/decorators/current-actor.decorator';
import { CurrentPrincipal } from '@platform/http/decorators/current-principal.decorator';
import { TERRAFORM_STATE_ROUTE } from '@platform/http/routes';
import type { Actor } from '@shared-kernel/domain/value-objects/actor.vo';
import type { Principal } from '@shared-kernel/domain/value-objects/principal.vo';

interface Answer {
  status(code: number): Answer;
  type(contentType: string): Answer;
  send(body?: Buffer | string): void;
  json(body: unknown): void;
}

interface Posted {
  readonly rawBody?: Uint8Array;
}

const NO_SUCH_STATE =
  'No such workspace, or you may not use its Terraform state.';

const forbidden = (act: string): ForbiddenException =>
  new ForbiddenException(
    `Your token or role does not give the ${act} permission in this workspace.`,
  );

const md5Of = (body: Uint8Array): string =>
  createHash('md5').update(body).digest('hex');

const assertDigest = (md5: string, sent: string | undefined): void => {
  if (sent && Buffer.from(sent, 'base64').toString('hex') !== md5) {
    throw new BadRequestException(
      'The Content-MD5 header does not match the state Terraform sent. Please run the command again.',
    );
  }
};

const sent = (info: unknown): boolean =>
  info !== undefined &&
  info !== null &&
  !(typeof info === 'object' && Object.keys(info).length === 0);

const settle = (changed: StateChanged, answer: Answer): void => {
  if (!changed) {
    throw new NotFoundException(NO_SUCH_STATE);
  }

  switch (changed.outcome) {
    case 'forbidden':
      throw forbidden(changed.act);
    case 'locked':
      answer.status(HttpStatus.LOCKED).json(changed.holder);
      return;
    case 'done':
      answer.status(HttpStatus.OK).send();
  }
};

@ApiExcludeController()
@Controller(TERRAFORM_STATE_ROUTE)
@AllowWorkspaceTokens()
@AllowBasicCredentials()
export class TerraformStateController {
  constructor(
    private readonly queryBus: QueryBus,
    private readonly commandBus: CommandBus,
  ) {}

  @Get()
  async read(
    @Param('slug') slug: string,
    @Param('name') name: string,
    @CurrentPrincipal() principal: Principal,
    @Res() answer: Answer,
  ): Promise<void> {
    const read = await this.queryBus.execute<
      ReadTerraformStateQuery,
      StateRead
    >(new ReadTerraformStateQuery(slug, name, principal));

    if (!read) {
      throw new NotFoundException(NO_SUCH_STATE);
    }

    switch (read.outcome) {
      case 'forbidden':
        throw forbidden(read.act);
      case 'empty':
        answer.status(HttpStatus.NO_CONTENT).send();
        return;
      case 'found':
        answer
          .status(HttpStatus.OK)
          .type('application/json')
          .send(Buffer.from(read.body));
    }
  }

  @Post()
  async write(
    @Param('slug') slug: string,
    @Param('name') name: string,
    @Query('ID') lockId: string | undefined,
    @Headers('content-md5') sentMd5: string | undefined,
    @CurrentActor() actor: Actor,
    @Req() request: Posted,
    @Res() answer: Answer,
  ): Promise<void> {
    const body = request.rawBody ?? new Uint8Array();
    const md5 = md5Of(body);

    assertDigest(md5, sentMd5);

    settle(
      await this.commandBus.execute<WriteTerraformStateCommand, StateChanged>(
        new WriteTerraformStateCommand(
          slug,
          name,
          actor,
          lockId || null,
          body,
          md5,
        ),
      ),
      answer,
    );
  }

  @Post('lock')
  async lock(
    @Param('slug') slug: string,
    @Param('name') name: string,
    @Body() info: unknown,
    @CurrentActor() actor: Actor,
    @Res() answer: Answer,
  ): Promise<void> {
    settle(
      await this.commandBus.execute<LockTerraformStateCommand, StateChanged>(
        new LockTerraformStateCommand(slug, name, actor, info),
      ),
      answer,
    );
  }

  @Delete('lock')
  async unlock(
    @Param('slug') slug: string,
    @Param('name') name: string,
    @Body() info: unknown,
    @CurrentActor() actor: Actor,
    @Res() answer: Answer,
  ): Promise<void> {
    settle(
      await this.commandBus.execute<UnlockTerraformStateCommand, StateChanged>(
        new UnlockTerraformStateCommand(
          slug,
          name,
          actor,
          sent(info) ? info : null,
        ),
      ),
      answer,
    );
  }
}
