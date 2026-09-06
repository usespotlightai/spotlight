import { InvalidAnalysisPromptError } from '@domain/exceptions/invalid-analysis-prompt.error';
import { AnalysisPrompt } from '@domain/value-objects/analysis-prompt.vo';
import { describe, expect, it } from 'vitest';

describe('AnalysisPrompt', () => {
  it('fills {trace} and {task} in the title and the brief', () => {
    const prompt = AnalysisPrompt.of({
      title: 'Analyse trace: {trace}',
      brief: 'The trace of {trace}, task {task}.',
    });

    expect(prompt.render({ trace: 'Fix the queue', task: 'task_1' })).toEqual({
      title: 'Analyse trace: Fix the queue',
      note: 'The trace of Fix the queue, task task_1.',
    });
  });

  it('fills every occurrence of a stand-in', () => {
    const prompt = AnalysisPrompt.of({
      title: '{trace}',
      brief: '{task} {task}',
    });

    expect(prompt.render({ trace: 't', task: 'x' }).note).toBe('x x');
  });

  it('trims what it is given', () => {
    const prompt = AnalysisPrompt.of({ title: '  a  ', brief: '  b  ' });

    expect(prompt.title).toBe('a');
    expect(prompt.brief).toBe('b');
  });

  it('refuses an empty title or brief', () => {
    expect(() => AnalysisPrompt.of({ title: '   ', brief: 'b' })).toThrow(
      InvalidAnalysisPromptError,
    );
    expect(() => AnalysisPrompt.of({ title: 'a', brief: '' })).toThrow(
      InvalidAnalysisPromptError,
    );
  });

  it('equals another written the same', () => {
    const one = AnalysisPrompt.of({ title: 'a', brief: 'b' });

    expect(one.equals(AnalysisPrompt.of({ title: 'a', brief: 'b' }))).toBe(
      true,
    );
    expect(one.equals(AnalysisPrompt.of({ title: 'a', brief: 'c' }))).toBe(
      false,
    );
  });
});
