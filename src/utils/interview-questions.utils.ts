import type { VoiceConversationEntryDTO } from '@/services/interview.service';

/** What the transcript holds for a question the candidate chose not to, or could not, answer. */
export const SKIPPED_ANSWER = '[NO RESPONSE - SKIPPED]';

export interface QuestionRow {
  /** 1-based, in the order the interviewer asked: the number the grader cites for an area. */
  number: number;
  question: string;
  answer: string;
  /** The interviewer's rating of the answer, out of 10, when it gave one. */
  score: number | null;
  skipped: boolean;
  answered: boolean;
  /** How deep the question went, when the interviewer said (technical round, newer interviews). */
  level: 'BASIC' | 'INTERMEDIATE' | 'ADVANCED' | 'EXPERT' | null;
  /** Whether the answer met the pass mark, as the server judged it; null when it was not rated. */
  correct: boolean | null;
  /** The skill the question tested, such as "Python" (technical round, newer interviews). */
  skill: string | null;
  /** A coding question. */
  coding: boolean;
  /** A coding question re-asked or followed up: a correction attempt, not a new task. */
  recovery: boolean;
}

/** The pass mark the server judges answers by (interview.answer.pass-score); used for a reviewer's changed score. */
const PASS_SCORE = 6;

/**
 * The interview as numbered questions, each with the answer given to it.
 *
 * <p>Numbered by interviewer turn, in order, which is how the grader was shown the transcript, so a number it cites
 * for an area points at the same question here. Follow-ups and rephrasings count as questions of their own, as they
 * do for the grader.</p>
 */
/**
 * The question number each candidate turn answers, by entry id: the count of interviewer turns before it, the same
 * numbering the grader used. Lets a per-question note be shown under the answer it is about.
 */
export function answerQuestionNumbers(transcript: VoiceConversationEntryDTO[]): Map<number, number> {
  const numbers = new Map<number, number>();
  let asked = 0;
  transcript.forEach((entry) => {
    if (entry.role === 'INTERVIEWER') asked += 1;
    else if (entry.role === 'CANDIDATE' && asked > 0) numbers.set(entry.id, asked);
  });
  return numbers;
}

export function questionRows(transcript: VoiceConversationEntryDTO[]): QuestionRow[] {
  const rows: QuestionRow[] = [];
  transcript.forEach((entry) => {
    if (entry.role === 'INTERVIEWER') {
      rows.push({
        number: rows.length + 1,
        question: entry.content ?? '',
        answer: '',
        score: null,
        skipped: false,
        answered: false,
        level: entry.level ?? null,
        correct: null,
        skill: entry.skill ?? null,
        coding: /^\s*\[CODING\]/i.test(entry.content ?? ''),
        recovery:
          /^\s*\[CODING\]/i.test(entry.content ?? '') && !!entry.turnKind && entry.turnKind !== 'NEW_QUESTION',
      });
      return;
    }
    const row = rows[rows.length - 1];
    if (entry.role !== 'CANDIDATE' || !row) return;
    const text = entry.content?.trim() ?? '';
    if (text === SKIPPED_ANSWER) {
      if (!row.answered) row.skipped = true;
      return;
    }
    if (!text) return;
    row.answered = true;
    row.skipped = false;
    row.answer = row.answer ? `${row.answer} ${text}` : text;
    // A reviewer's score, where one was given, is the one that counts; the AI's stays on the answer itself.
    if (entry.reviewedScore != null) {
      row.score = entry.reviewedScore;
      row.correct = entry.reviewedScore >= PASS_SCORE;
      return;
    }
    if (entry.answerScore != null) row.score = entry.answerScore;
    if (entry.answerCorrect != null) row.correct = entry.answerCorrect;
  });
  return rows;
}
