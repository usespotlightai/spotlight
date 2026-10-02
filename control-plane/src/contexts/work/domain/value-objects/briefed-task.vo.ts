import { Repository } from '@shared-kernel/domain/value-objects/repository.vo';
import { Attachment } from '@work/domain/value-objects/attachment.vo';
import { NotePosition } from '@work/domain/value-objects/note-position.vo';
import { StationId } from '@work/domain/value-objects/station-id.vo';

export interface BriefedNote {
  readonly station: string;
  readonly body: string;
  readonly attachments: readonly Attachment[];
}

export interface BriefedRemark {
  readonly at: NotePosition;
  readonly place: string | null;
  readonly body: string;
}

export interface DecisionOnRecord {
  readonly kind: string;
  readonly title: string;
  readonly why: string;
  readonly paths: readonly string[];
  readonly disputes: readonly string[];
}

interface BriefedAttachmentParts {
  readonly id: string;
  readonly name: string;
  readonly contentType: string;
  readonly size: number;
}

export interface BriefedTaskParts {
  readonly stationId: string;
  readonly title: string;
  readonly description: string | null;
  readonly reviewing: string | null;
  readonly attachments: readonly BriefedAttachmentParts[];
  readonly notes: readonly {
    readonly station: string;
    readonly body: string;
    readonly attachments: readonly BriefedAttachmentParts[];
  }[];
  readonly openRemarks: readonly {
    readonly at: number;
    readonly place: string | null;
    readonly body: string;
  }[];
  readonly decisions: readonly DecisionOnRecord[];
}

const attachmentParts = (
  attachments: readonly Attachment[],
): BriefedAttachmentParts[] =>
  attachments.map((each) => ({
    id: each.id.value,
    name: each.name,
    contentType: each.contentType,
    size: each.size,
  }));

const decisionsCopied = (
  decisions: readonly DecisionOnRecord[],
): DecisionOnRecord[] =>
  decisions.map((each) => ({
    kind: each.kind,
    title: each.title,
    why: each.why,
    paths: [...each.paths],
    disputes: [...each.disputes],
  }));

const sameDecisions = (
  one: readonly DecisionOnRecord[],
  other: readonly DecisionOnRecord[],
): boolean =>
  JSON.stringify(decisionsCopied(one)) ===
  JSON.stringify(decisionsCopied(other));

const sameAttachments = (
  one: readonly Attachment[],
  other: readonly Attachment[],
): boolean =>
  one.length === other.length &&
  one.every((each, at) => other[at]?.equals(each));

export class BriefedTask {
  private constructor(
    readonly stationId: StationId,
    readonly title: string,
    readonly description: string | null,
    readonly reviewing: Repository | null,
    readonly attachments: readonly Attachment[],
    readonly notes: readonly BriefedNote[],
    readonly openRemarks: readonly BriefedRemark[],
    readonly decisions: readonly DecisionOnRecord[],
  ) {}

  static of(input: {
    stationId: StationId;
    title: string;
    description: string | null;
    reviewing: Repository | null;
    attachments: readonly Attachment[];
    notes: readonly BriefedNote[];
    openRemarks: readonly BriefedRemark[];
    decisions?: readonly DecisionOnRecord[];
  }): BriefedTask {
    return new BriefedTask(
      input.stationId,
      input.title,
      input.description,
      input.reviewing,
      [...input.attachments],
      input.notes.map((each) => ({
        station: each.station,
        body: each.body,
        attachments: [...each.attachments],
      })),
      input.openRemarks.map((each) => ({
        at: each.at,
        place: each.place,
        body: each.body,
      })),
      decisionsCopied(input.decisions ?? []),
    );
  }

  withDecisions(decisions: readonly DecisionOnRecord[]): BriefedTask {
    return BriefedTask.of({ ...this, decisions });
  }

  static rehydrate(parts: BriefedTaskParts): BriefedTask {
    return BriefedTask.of({
      stationId: StationId.of(parts.stationId),
      title: parts.title,
      description: parts.description,
      reviewing: parts.reviewing ? Repository.of(parts.reviewing) : null,
      attachments: parts.attachments.map(Attachment.rehydrate),
      notes: parts.notes.map((each) => ({
        station: each.station,
        body: each.body,
        attachments: each.attachments.map(Attachment.rehydrate),
      })),
      openRemarks: parts.openRemarks.map((each) => ({
        at: NotePosition.of(each.at),
        place: each.place,
        body: each.body,
      })),
      decisions: parts.decisions,
    });
  }

  get allAttachments(): readonly Attachment[] {
    return [
      ...this.attachments,
      ...this.notes.flatMap((note) => note.attachments),
    ];
  }

  get parts(): BriefedTaskParts {
    return {
      stationId: this.stationId.value,
      title: this.title,
      description: this.description,
      reviewing: this.reviewing?.value ?? null,
      attachments: attachmentParts(this.attachments),
      notes: this.notes.map((each) => ({
        station: each.station,
        body: each.body,
        attachments: attachmentParts(each.attachments),
      })),
      openRemarks: this.openRemarks.map((each) => ({
        at: each.at.value,
        place: each.place,
        body: each.body,
      })),
      decisions: decisionsCopied(this.decisions),
    };
  }

  equals(other: BriefedTask): boolean {
    return (
      this.stationId.equals(other.stationId) &&
      this.title === other.title &&
      this.description === other.description &&
      (this.reviewing?.value ?? null) === (other.reviewing?.value ?? null) &&
      sameAttachments(this.attachments, other.attachments) &&
      this.notes.length === other.notes.length &&
      this.notes.every((each, at) => {
        const theirs = other.notes[at];
        return (
          theirs !== undefined &&
          each.station === theirs.station &&
          each.body === theirs.body &&
          sameAttachments(each.attachments, theirs.attachments)
        );
      }) &&
      this.openRemarks.length === other.openRemarks.length &&
      this.openRemarks.every((each, at) => {
        const theirs = other.openRemarks[at];
        return (
          theirs !== undefined &&
          each.at.equals(theirs.at) &&
          each.place === theirs.place &&
          each.body === theirs.body
        );
      }) &&
      sameDecisions(this.decisions, other.decisions)
    );
  }
}
