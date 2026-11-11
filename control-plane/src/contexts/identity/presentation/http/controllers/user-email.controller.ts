import { AddUserEmailCommand } from '@identity/application/commands/add-user-email.command';
import { RemoveUserEmailCommand } from '@identity/application/commands/remove-user-email.command';
import { ResendUserEmailVerificationCommand } from '@identity/application/commands/resend-user-email-verification.command';
import { VerifyUserEmailCommand } from '@identity/application/commands/verify-user-email.command';
import type {
  UserEmailDto,
  UserEmailsDto,
} from '@identity/application/dto/user-email.dto';
import { ListUserEmailsQuery } from '@identity/application/queries/list-user-emails.query';
import { AddUserEmailRequestDto } from '@identity/presentation/http/dto/user-email.request.dto';
import {
  UserEmailResponseDto,
  UserEmailsResponseDto,
} from '@identity/presentation/http/dto/user-email.response.dto';
import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  NotFoundException,
  Param,
  Post,
} from '@nestjs/common';
import { CommandBus, QueryBus } from '@nestjs/cqrs';
import {
  ApiBadGatewayResponse,
  ApiConflictResponse,
  ApiForbiddenResponse,
  ApiNoContentResponse,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiOperation,
  ApiParam,
  ApiTags,
  ApiUnauthorizedResponse,
  ApiUnprocessableEntityResponse,
} from '@nestjs/swagger';
import type { AuthenticatedUser } from '@platform/http/authenticated-user';
import { CurrentUser } from '@platform/http/decorators/current-user.decorator';

@ApiTags('emails')
@ApiUnauthorizedResponse({ description: 'No valid session' })
@Controller('me')
export class UserEmailController {
  constructor(
    private readonly commandBus: CommandBus,
    private readonly queryBus: QueryBus,
  ) {}

  @Get('emails')
  @ApiOperation({
    operationId: 'listMyEmails',
    summary: 'List your sign-in email and your additional emails',
  })
  @ApiOkResponse({ type: UserEmailsResponseDto })
  async list(
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<UserEmailsResponseDto> {
    return this.queryBus.execute<ListUserEmailsQuery, UserEmailsDto>(
      new ListUserEmailsQuery(user.id, user.email),
    );
  }

  @Post('emails')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    operationId: 'addMyEmail',
    summary: 'Add an email address and send a verification link to it',
    description:
      'Once verified, Spotlight can recognize you by the address across connected services. Adding an address that waits for verification sends a fresh link.',
  })
  @ApiOkResponse({ type: UserEmailResponseDto })
  @ApiConflictResponse({
    description:
      'The address is already verified, was just added, or got a link less than a minute ago, or your account got 10 links in the last hour',
  })
  @ApiUnprocessableEntityResponse({
    description:
      'Not an email address, your sign-in email, or one more than the 10 allowed',
  })
  @ApiBadGatewayResponse({ description: 'The email could not be sent' })
  async add(
    @Body() body: AddUserEmailRequestDto,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<UserEmailResponseDto> {
    return this.commandBus.execute<AddUserEmailCommand, UserEmailDto>(
      new AddUserEmailCommand(String(body.email ?? ''), user.id, user.email),
    );
  }

  @Post('emails/:userEmailId/resend')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    operationId: 'resendMyEmailVerification',
    summary: 'Send a fresh verification link, valid for 24 hours',
  })
  @ApiParam({ name: 'userEmailId' })
  @ApiOkResponse({ type: UserEmailResponseDto })
  @ApiConflictResponse({
    description:
      'The address is already verified, or got a link less than a minute ago, or your account got 10 links in the last hour',
  })
  @ApiNotFoundResponse({ description: 'No such address of yours' })
  @ApiBadGatewayResponse({ description: 'The email could not be sent' })
  async resend(
    @Param('userEmailId') userEmailId: string,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<UserEmailResponseDto> {
    const resent = await this.commandBus.execute<
      ResendUserEmailVerificationCommand,
      UserEmailDto | null
    >(new ResendUserEmailVerificationCommand(userEmailId, user.id, user.email));

    if (!resent) {
      throw new NotFoundException();
    }

    return resent;
  }

  @Delete('emails/:userEmailId')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({
    operationId: 'removeMyEmail',
    summary: 'Remove an additional email address',
    description: 'Spotlight no longer matches the address to you.',
  })
  @ApiParam({ name: 'userEmailId' })
  @ApiNoContentResponse({ description: 'The address is removed' })
  @ApiConflictResponse({ description: 'The address changed meanwhile' })
  @ApiNotFoundResponse({ description: 'No such address of yours' })
  async remove(
    @Param('userEmailId') userEmailId: string,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<void> {
    const removed = await this.commandBus.execute<
      RemoveUserEmailCommand,
      boolean
    >(new RemoveUserEmailCommand(userEmailId, user.id));

    if (!removed) {
      throw new NotFoundException();
    }
  }

  @Post('email-verifications/:token')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    operationId: 'verifyMyEmail',
    summary: 'Verify an email address with the link Spotlight sent to it',
  })
  @ApiParam({ name: 'token' })
  @ApiOkResponse({ type: UserEmailResponseDto })
  @ApiForbiddenResponse({ description: 'Another account added the address' })
  @ApiConflictResponse({
    description: 'The link expired, or another account has the address',
  })
  @ApiNotFoundResponse({ description: 'No verification by that link' })
  async verify(
    @Param('token') token: string,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<UserEmailResponseDto> {
    const verified = await this.commandBus.execute<
      VerifyUserEmailCommand,
      UserEmailDto | null
    >(new VerifyUserEmailCommand(token, user.id));

    if (!verified) {
      throw new NotFoundException();
    }

    return verified;
  }
}
