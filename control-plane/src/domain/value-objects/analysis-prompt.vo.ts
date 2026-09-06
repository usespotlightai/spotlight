import { InvalidAnalysisPromptError } from '@domain/exceptions/invalid-analysis-prompt.error';

export interface AnalysisSubject {
  readonly trace: string;
  readonly task: string;
}

export interface Analysis {
  readonly title: string;
  readonly note: string;
}

/**
 * The prompt an "Analyse with AI" from a trace turns into: a title and a brief,
 * each written with {trace} and {task} standing in for the trace it is about
 * and the task it studies. Configured on the line the same way a station's
 * prompt is, so a team edits it in its own repository.
 */
export class AnalysisPrompt {
  private constructor(
    readonly title: string,
    readonly brief: string,
  ) {}

  static of(input: { title: string; brief: string }): AnalysisPrompt {
    const title = input.title.trim();
    const brief = input.brief.trim();

    if (title.length === 0) {
      throw new InvalidAnalysisPromptError('has no title');
    }
    if (brief.length === 0) {
      throw new InvalidAnalysisPromptError('has no brief');
    }

    return new AnalysisPrompt(title, brief);
  }

  render(subject: AnalysisSubject): Analysis {
    return {
      title: fill(this.title, subject),
      note: fill(this.brief, subject),
    };
  }

  equals(other: AnalysisPrompt): boolean {
    return this.title === other.title && this.brief === other.brief;
  }
}

const fill = (template: string, subject: AnalysisSubject): string =>
  template
    .replaceAll('{trace}', subject.trace)
    .replaceAll('{task}', subject.task);
