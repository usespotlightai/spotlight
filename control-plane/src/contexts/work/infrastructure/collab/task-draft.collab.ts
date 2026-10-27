import { Inject, Injectable, type OnModuleInit } from '@nestjs/common';
import { CommandBus, QueryBus } from '@nestjs/cqrs';
import type { CollabDocuments } from '@platform/collab/collab-documents';
import { CollabServer } from '@platform/collab/collab-server';
import {
  type RequestHeaders,
  SESSION_READER,
  type SessionReaderPort,
} from '@shared-kernel/application/ports/session.port';
import { KeepTaskDraftCommand } from '@work/application/commands/keep-task-draft.command';
import type { StoredDraft } from '@work/application/ports/task-draft-states.port';
import {
  JoinTaskDraftQuery,
  ReadTaskDraftQuery,
} from '@work/application/queries/task-draft.queries';
import {
  draftParts,
  generationOf,
  TASK_DRAFT,
} from '@work/infrastructure/collab/task-draft.document';
import { applyUpdate, type Doc } from 'yjs';

@Injectable()
export class TaskDraftCollab implements CollabDocuments, OnModuleInit {
  constructor(
    private readonly collab: CollabServer,
    private readonly queryBus: QueryBus,
    private readonly commandBus: CommandBus,
    @Inject(SESSION_READER) private readonly sessions: SessionReaderPort,
  ) {}

  onModuleInit(): void {
    this.collab.serve(TASK_DRAFT, this);
  }

  async admit(taskId: string, headers: RequestHeaders): Promise<boolean> {
    const user = await this.sessions.read(headers);

    return (
      user !== null &&
      this.queryBus.execute<JoinTaskDraftQuery, boolean>(
        new JoinTaskDraftQuery(taskId, user.id),
      )
    );
  }

  async load(taskId: string, doc: Doc): Promise<void> {
    const stored = await this.queryBus.execute<ReadTaskDraftQuery, StoredDraft>(
      new ReadTaskDraftQuery(taskId),
    );

    if (stored.state) {
      applyUpdate(doc, stored.state);
    }

    if (generationOf(doc) < stored.generation) {
      draftParts(doc).meta.set('generation', stored.generation);
    }
  }

  async keep(taskId: string, state: Uint8Array): Promise<void> {
    await this.commandBus.execute(new KeepTaskDraftCommand(taskId, state));
  }
}
