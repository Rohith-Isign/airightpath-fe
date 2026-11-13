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
}

/**
 * The interview as numbered questions, each with the answer given to it.
 *
 * <p>Numbered by interviewer turn, in order, which is how the grader was shown the transcript, so a number it cites
 * for an area points at the same question here. Follow-ups and rephrasings count as questions of their own, as they
 * do for the grader.</p>
 */
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
    if (entry.answerScore != null) row.score = entry.answerScore;
  });
  return rows;
}
