import { stampBrand } from '@/utils/answer-sheet.utils';
import { isNotAssessable } from '@/utils/interview-standing.utils';
import { performanceLevel } from '@/utils/performance-level.utils';
import { describeInterviewSubmission } from '@/utils/interview-submission.utils';
import { questionRows, type QuestionRow } from '@/utils/interview-questions.utils';
import { l2Category, toPercent } from '@/utils/l2-category.utils';
import { areaLabel, CONCEPT_STATUS_LABELS } from '@/utils/interview-areas.utils';
import type { InterviewSchedule, ProctoringEvent, VoiceEvaluationResult } from '@/types/interview.types';
import type { VoiceConversationEntryDTO } from '@/services/interview.service';

/**
 * One interview as a shareable PDF, watermarked like every other document the
 * platform produces.
 *
 * <p>It follows the results page section by section, so what a hiring manager reads in the PDF is what the reviewer
 * saw on screen: the verdict and headline scores, the hiring verdict, why it was flagged, how it ended, proctoring,
 * scores by area, level-wise achievement, coverage by area with every expected concept, strengths and gaps, and the
 * transcript. It had fallen behind the page and left out most of that.</p>
 *
 * <p>The brand stamp is imported rather than reimplemented: one watermark, one
 * place to change it, and no chance of the interview PDF quietly diverging
 * from the exam one.</p>
 */
export interface InterviewReportInput {
  schedule: InterviewSchedule;
  evaluation: VoiceEvaluationResult | null;
  transcript: VoiceConversationEntryDTO[];
  /** Why it was flagged for review, if it was. */
  reviewReasons?: string[];
  /** The proctoring record for this sitting. */
  proctoring?: ProctoringEvent[];
  generatedAt: Date;
}

const LEVELS = ['BASIC', 'INTERMEDIATE', 'ADVANCED', 'EXPERT'] as const;
const LEVEL_NAMES: Record<string, string> = {
  NONE: 'None',
  BASIC: 'Basic',
  INTERMEDIATE: 'Intermediate',
  ADVANCED: 'Advanced',
  EXPERT: 'Expert',
};

function confidenceWords(confidence: number): string {
  if (confidence >= 0.75) return 'High';
  if (confidence >= 0.5) return 'Medium';
  return 'Low';
}

/** Weights arrive as a share (0.22), or as a percentage on older results. */
function weightLabel(weight: number): string {
  return `${Math.round(weight <= 1 ? weight * 100 : weight)}%`;
}

export async function buildInterviewReportPdf(input: InterviewReportInput): Promise<Blob> {
  // On demand — jsPDF is dead weight on every screen that never exports.
  const { jsPDF, GState } = await import('jspdf');

  const doc = new jsPDF({ unit: 'pt', format: 'a4' });
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const margin = 48;
  const width = pageWidth - margin * 2;
  let y = margin;

  const ensureRoom = (needed: number) => {
    if (y + needed <= pageHeight - margin) return;
    doc.addPage();
    y = margin;
  };

  const write = (
    text: string,
    { size = 10, style = 'normal' as 'normal' | 'bold' | 'italic', gap = 3, indent = 0 } = {}
  ) => {
    if (!text) return;
    doc.setFont('helvetica', style);
    doc.setFontSize(size);
    const lines = doc.splitTextToSize(text, width - indent) as string[];
    const lineHeight = size * 1.35;
    for (const line of lines) {
      ensureRoom(lineHeight);
      doc.text(line, margin + indent, y);
      y += lineHeight;
    }
    y += gap;
  };

  const heading = (text: string) => {
    ensureRoom(40);
    y += 6;
    doc.setTextColor(17);
    write(text, { size: 13, style: 'bold', gap: 6 });
  };

  const muted = (text: string, size = 8.5) => {
    doc.setTextColor(110);
    write(text, { size, gap: 3 });
    doc.setTextColor(17);
  };

  /** A simple ruled table. Cells wrap; a row moves to the next page whole. */
  const table = (headers: string[], rows: string[][], ratios: number[]) => {
    const total = ratios.reduce((sum, r) => sum + r, 0);
    const cols = ratios.map((r) => (r / total) * width);
    const size = 8.5;
    const lineHeight = size * 1.3;
    const drawRow = (cells: string[], header: boolean) => {
      doc.setFont('helvetica', header ? 'bold' : 'normal');
      doc.setFontSize(size);
      const wrapped = cells.map((cell, i) => doc.splitTextToSize(cell ?? '', cols[i] - 8) as string[]);
      const height = Math.max(1, ...wrapped.map((w) => w.length)) * lineHeight + 6;
      ensureRoom(height + 2);
      const top = y;
      if (header) {
        doc.setFillColor(243, 244, 246);
        doc.rect(margin, top, width, height, 'F');
      }
      let x = margin;
      wrapped.forEach((lines, i) => {
        lines.forEach((line, j) => doc.text(line, x + 4, top + size + 2 + j * lineHeight));
        x += cols[i];
      });
      y = top + height;
      doc.setDrawColor(220);
      doc.line(margin, y, margin + width, y);
    };
    drawRow(headers, true);
    rows.forEach((row) => drawRow(row, false));
    y += 16;
  };

  const { schedule, evaluation, transcript } = input;
  const isTechnical = (schedule.round ?? 'L2_TECHNICAL') === 'L2_TECHNICAL';
  const rows: QuestionRow[] = questionRows(transcript);

  // ── Who and what ─────────────────────────────────────────────────
  write('Interview Report', { size: 18, style: 'bold', gap: 2 });
  muted(`${schedule.roundLabel ?? schedule.round ?? 'Interview'} · ${schedule.jobPrefix}`, 10);
  write(schedule.email, { size: 11, gap: 2 });
  muted(`Generated ${input.generatedAt.toLocaleString()}`);

  // ── The verdict ──────────────────────────────────────────────────
  heading('Result');
  const score = evaluation?.overallScore;
  if (isNotAssessable(schedule)) {
    write('Overall score: not assessable (the candidate did not answer any question)', {
      size: 11,
      style: 'bold',
      gap: 2,
    });
  } else if (score == null) {
    write('Overall score: not scored', { size: 11, style: 'bold', gap: 2 });
  } else if (isTechnical) {
    // The same headline numbers the page shows for a technical round.
    const overall = toPercent(score);
    const technical = toPercent(evaluation?.assessedScore ?? score);
    const category = l2Category(overall);
    write(`Overall L2 score: ${overall}% (${category ?? 'Below Good'})`, { size: 11, style: 'bold', gap: 2 });
    write(`Technical score (on what was tested): ${technical}%`, { gap: 2 });
  } else {
    write(`Overall score: ${score.toFixed(1)} / 10 (${performanceLevel(score)?.label ?? ''})`, {
      size: 11,
      style: 'bold',
      gap: 2,
    });
  }
  if (evaluation?.scopeScore != null && evaluation.expectedConcepts?.length) {
    const reached = evaluation.expectedConcepts.filter((c) => c.status !== 'NOT_ASKED').length;
    write(
      `Score against the full scope: ${Math.round(evaluation.scopeScore)} / 100 ` +
        `(${reached} of ${evaluation.expectedConcepts.length} expected concepts reached)`,
      { gap: 2 },
    );
  }
  const facts: string[] = [];
  if (evaluation?.coverage != null) facts.push(`Coverage ${Math.round(evaluation.coverage * 100)}%`);
  if (evaluation?.confidence != null) {
    facts.push(
      `Evaluator confidence ${confidenceWords(evaluation.confidence)} (${Math.round(evaluation.confidence * 100)}%)`,
    );
  }
  const categories = evaluation?.categoryScores ?? [];
  if (categories.length) {
    const assessed = categories.filter((c) => c.assessed !== false).length;
    facts.push(`${isTechnical ? 'Skills' : 'Areas'} covered ${assessed} of ${categories.length}`);
  }
  const best = categories.reduce(
    (top, c) => Math.max(top, c.highestLevel ? LEVELS.indexOf(c.highestLevel as (typeof LEVELS)[number]) + 1 : 0),
    0,
  );
  if (best > 0) facts.push(`Highest level shown ${LEVEL_NAMES[LEVELS[best - 1]]}`);
  if (facts.length) muted(facts.join('   ·   '), 9);

  if (evaluation?.recommendation) {
    write(`Recommendation: ${evaluation.recommendation.replace(/_/g, ' ')}`, { gap: 2 });
  }
  // The result that stands, which is not always the machine's.
  if (schedule.overriddenResult) {
    write(
      `Result overridden to ${schedule.overriddenResult}` +
        (schedule.overriddenBy ? ` by ${schedule.overriddenBy}` : ''),
      { style: 'bold', gap: 2 }
    );
    muted(`The AI concluded ${schedule.interviewResult.toLowerCase()}.`);
  } else {
    write(`Result: ${schedule.interviewResult}`, { gap: 2 });
  }
  if (evaluation?.summary) {
    write(evaluation.summary, { gap: 6 });
  }

  // ── The verdict a person would give ──────────────────────────────
  if (evaluation?.verdict || evaluation?.observedSeniority || evaluation?.notCovered?.length || evaluation?.depthGaps?.length) {
    heading('Hiring verdict');
    if (evaluation.observedSeniority) write(`Level shown: ${evaluation.observedSeniority}`, { style: 'bold', gap: 2 });
    if (evaluation.verdict) write(evaluation.verdict, { gap: 4 });
    if (evaluation.notCovered?.length) {
      write('Not covered in this interview:', { size: 9.5, style: 'bold', gap: 1 });
      evaluation.notCovered.forEach((item) => write(`• ${item}`, { size: 9.5, indent: 10, gap: 1 }));
      y += 3;
    }
    if (evaluation.depthGaps?.length) {
      write('Right, but not deep enough:', { size: 9.5, style: 'bold', gap: 1 });
      evaluation.depthGaps.forEach((item) => write(`• ${item}`, { size: 9.5, indent: 10, gap: 1 }));
    }
  }

  // ── Why a person should look ─────────────────────────────────────
  if (input.reviewReasons?.length) {
    heading('Flagged for review');
    input.reviewReasons.forEach((reason) => write(`• ${reason}`, { indent: 10, gap: 1 }));
  }

  // ── How it ended ─────────────────────────────────────────────────
  const submission = describeInterviewSubmission(schedule);
  if (submission) {
    heading('Submission');
    write(submission.label, { style: 'bold', gap: 2 });
    write(submission.reason, { gap: 4 });
    muted(
      `Started ${fmt(submission.startedAt)}   ·   Ended ${fmt(submission.endedAt)}` +
        (submission.durationLabel ? `   ·   ${submission.durationLabel}` : '')
    );
  }

  // ── Proctoring ───────────────────────────────────────────────────
  const proctoring = input.proctoring ?? [];
  heading(`Proctoring events (${proctoring.length})`);
  if (proctoring.length === 0) {
    muted('Nothing was flagged.', 9);
  } else {
    table(
      ['Time', 'Event', 'Details'],
      proctoring.map((event) => [
        fmt(event.timestamp),
        (event.eventType ?? 'event').replace(/_/g, ' '),
        event.details ?? '',
      ]),
      [1.3, 1.4, 3.3],
    );
  }

  // ── Scores by area ───────────────────────────────────────────────
  if (categories.length) {
    heading(isTechnical ? 'Scores by skill' : 'Scores by area');
    const hasLevels = categories.some((c) => c.highestLevel != null);
    const hasMapped = categories.some((c) => c.mapped != null);
    const headers = ['Area', 'Weight', 'Score'];
    if (hasLevels) headers.push('Level reached');
    if (hasMapped) headers.push('On resume');
    headers.push('Questions');
    table(
      headers,
      categories.map((c) => {
        const assessed = c.assessed !== false;
        const cells = [c.category, weightLabel(c.weight), assessed ? `${c.score}/10` : 'Not assessed'];
        if (hasLevels) cells.push(c.highestLevel ? LEVEL_NAMES[c.highestLevel] ?? c.highestLevel : '—');
        if (hasMapped) cells.push(c.mapped == null ? '—' : c.mapped ? 'Yes' : 'No');
        cells.push(c.questionNumbers?.length ? `Q${c.questionNumbers.join(', Q')}` : '—');
        return cells;
      }),
      hasLevels && hasMapped ? [2.2, 0.8, 1, 1.2, 0.9, 1.6] : [2.4, 0.9, 1.1, 1.8],
    );
    categories.forEach((c) => {
      if (!c.feedback) return;
      write(c.category, { size: 9.5, style: 'bold', gap: 1 });
      write(c.feedback, { size: 9, indent: 10, gap: 4 });
    });
  }

  // ── Level-wise achievement ───────────────────────────────────────
  if (rows.some((r) => r.level)) {
    heading('Level-wise achievement');
    table(
      ['Level', 'Questions', 'Answered', 'Correct', 'Average'],
      LEVELS.map((level) => {
        const atLevel = rows.filter((r) => r.level === level);
        const scored = atLevel.map((r) => r.score).filter((s): s is number => s != null);
        const judged = atLevel.filter((r) => r.correct != null);
        return [
          LEVEL_NAMES[level],
          atLevel.length ? String(atLevel.length) : 'None asked',
          String(atLevel.filter((r) => r.answered).length),
          judged.length ? `${judged.filter((r) => r.correct).length} of ${judged.length}` : '—',
          scored.length ? `${Math.round((scored.reduce((a, b) => a + b, 0) / scored.length) * 10)}%` : '—',
        ];
      }),
      [1.4, 1, 1, 1, 1],
    );
  }

  // ── Coverage by area ─────────────────────────────────────────────
  const concepts = evaluation?.expectedConcepts ?? [];
  const questionAreas = evaluation?.questionAreas ?? [];
  if (concepts.length || questionAreas.length) {
    heading('Coverage by area');
    const areas = [...new Set([...concepts.map((c) => c.area), ...questionAreas.map((q) => q.area)])];
    table(
      ['Area', 'Questions', 'Answered', 'Correct', 'Avg answer', 'Concepts reached'],
      areas.map((area) => {
        const asked = questionAreas
          .filter((q) => q.area === area)
          .map((q) => rows.find((r) => r.number === q.questionNumber))
          .filter((r): r is QuestionRow => r !== undefined);
        const scored = asked.map((r) => r.score).filter((s): s is number => s != null);
        const judged = asked.filter((r) => r.correct != null);
        const expected = concepts.filter((c) => c.area === area);
        return [
          areaLabel(area),
          String(asked.length),
          String(asked.filter((r) => r.answered).length),
          judged.length ? `${judged.filter((r) => r.correct).length} of ${judged.length}` : '—',
          scored.length ? `${(scored.reduce((a, b) => a + b, 0) / scored.length).toFixed(1)}/10` : '—',
          expected.length
            ? `${expected.filter((c) => c.status !== 'NOT_ASKED').length} of ${expected.length}`
            : '—',
        ];
      }),
      [1.6, 1, 1, 1, 1.1, 1.3],
    );
    if (concepts.length) {
      write('Expected concepts', { size: 10, style: 'bold', gap: 2 });
      muted('Every concept a complete interview for this role should have tested. "Not asked" earns nothing.', 8.5);
      table(
        ['Area', 'Concept', 'Result', 'Questions'],
        concepts.map((c) => [
          areaLabel(c.area),
          c.concept,
          CONCEPT_STATUS_LABELS[c.status] ?? c.status,
          c.questionNumbers?.length ? `Q${c.questionNumbers.join(', Q')}` : '—',
        ]),
        [1.2, 3, 1, 1],
      );
    }
  }

  bulletSection('Strengths', evaluation?.strengths);
  bulletSection('Areas to improve', evaluation?.areasForImprovement);

  // ── What was actually said ───────────────────────────────────────
  if (transcript.length) {
    heading(`Transcript (${transcript.length} turns)`);
    transcript.forEach((entry) => {
      const isCandidate = entry.role === 'CANDIDATE';
      const who = isCandidate ? 'Candidate' : 'Interviewer';
      const raw = entry.content ?? '';
      const isCodingQuestion = !isCandidate && /^\s*\[CODING\]/i.test(raw);
      // The tag is for the candidate's screen, and a code answer's text carries the code and a grader's note after
      // the spoken words. The code is printed once, below, as on the results page.
      const text = isCodingQuestion
        ? raw.replace(/^\s*\[CODING\]\s*/i, '')
        : isCandidate && entry.codeContent
          ? raw.split(/\n*\[CODE \(/)[0].trim() || '(Answered in the notepad, without speaking)'
          : raw;
      const tags = [
        entry.level ? LEVEL_NAMES[entry.level] ?? entry.level : null,
        isCodingQuestion ? 'coding' : null,
        entry.topic ? `domain: ${entry.topic}` : null,
        entry.turnKind && entry.turnKind !== 'NEW_QUESTION'
          ? entry.turnKind.replace('_', ' ').toLowerCase()
          : null,
        entry.answerScore != null ? `${entry.answerScore}/10` : null,
        entry.answerCorrect == null ? null : entry.answerCorrect ? 'correct' : 'not correct',
        entry.codeMismatch ? 'code solves a different problem: no marks' : null,
      ]
        .filter(Boolean)
        .join(' · ');

      write(tags ? `${who}  (${tags})` : who, { size: 9, style: 'bold', gap: 1 });
      write(text, { size: 9.5, indent: 10, gap: 2 });
      if (isCandidate && entry.codeContent) {
        muted('Code submitted:', 8);
        write(entry.codeContent, { size: 8, indent: 10, gap: 2 });
      }
      // An attempt to work the interviewer belongs in the record a hiring
      // decision is made from, not only on a screen somebody might scroll past.
      if (entry.injectionSuspected) {
        muted('[Flagged: tried to instruct the interviewer. It had no effect.]', 8);
      }
      y += 2;
    });
  }

  stampBrand(doc, GState);
  return doc.output('blob');

  function bulletSection(title: string, items?: string[]) {
    if (!items?.length) return;
    heading(title);
    items.forEach((item) => write(`• ${item}`, { indent: 10, gap: 1 }));
  }
}

/** A timestamp as a reader expects it, or a dash where there is none. */
function fmt(value?: string): string {
  if (!value) return '--';
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? '--' : date.toLocaleString();
}

/** Filename stem, matching the answer sheet's shape. */
export function interviewReportFileName(schedule: InterviewSchedule): string {
  const who = schedule.email.split('@')[0].replace(/[^\w.-]+/g, '-');
  const round = (schedule.round ?? 'interview').toLowerCase().replace(/_/g, '-');
  return `${schedule.jobPrefix}-${who}-${round}-interview.pdf`;
}
