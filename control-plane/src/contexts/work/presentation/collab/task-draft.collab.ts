import {
  SESSION_READER,
  type SessionReaderPort,
} from '@identity/application/ports/session-reader.port';
import { Inject, Injectable, type OnModuleInit } from '@nestjs/common';
import { CommandBus, QueryBus } from '@nestjs/cqrs';
import type { CollabDocuments } from '@platform/collab/collab-documents';
import { CollabServer } from '@platform/collab/collab-server';
import type { RequestHeaders } from '@platform/http/request-headers';
import { KeepTaskDraftCommand } from '@work/application/commands/keep-task-draft.command';
import {
  TASK_DRAFT_DOCUMENT,
  TASK_DRAFT_META,
  TASK_DRAFT_PARTS,
} from '@work/application/contracts/task-draft-document.contract';
import type { StoredDraft } from '@work/application/ports/task-draft-states.port';
import {
  JoinTaskDraftQuery,
  ReadTaskDraftQuery,
} from '@work/application/queries/task-draft.queries';
import { generationToShow } from '@work/application/services/draft-generations';
import { applyUpdate, type Doc } from 'yjs';

const metaOf = (doc: Doc) => doc.getMap<number | string>(TASK_DRAFT_PARTS.meta);

const generationOf = (doc: Doc): number => {
  const generation = metaOf(doc).get(TASK_DRAFT_META.generation);

  return typeof generation === 'number' ? generation : 0;
};

@Injectable()
export class TaskDraftCollab implements CollabDocuments, OnModuleInit {
  constructor(
    private readonly collab: CollabServer,
    private readonly queryBus: QueryBus,
    private readonly commandBus: CommandBus,
    @Inject(SESSION_READER) private readonly sessions: SessionReaderPort,
  ) {}

  onModuleInit(): void {
    this.collab.serve(TASK_DRAFT_DOCUMENT, this);
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

    const generation = generationToShow(generationOf(doc), stored.generation);

    if (generation !== null) {
      metaOf(doc).set(TASK_DRAFT_META.generation, generation);
    }
  }

  async keep(taskId: string, state: Uint8Array): Promise<void> {
    await this.commandBus.execute(new KeepTaskDraftCommand(taskId, state));
  }
}
