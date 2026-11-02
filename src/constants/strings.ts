// ─────────────────────────────────────────────────────────────────────────────
// User-facing text for the interview and assessment status screens.
//
// Components import from here instead of writing copy inline, so a wording change is one edit and the same state
// reads the same everywhere (admin list, result page, export, candidate list).
//
// Static text is a plain string; text with a value in it is a function. Toasts and notices for other modules live
// in `config/messages.ts`; server error text is in `config/error-messages.ts`.
// ─────────────────────────────────────────────────────────────────────────────

export const STRINGS = {
  /** How an interview's state is named, wherever it is shown. */
  interviewStatus: {
    assigned: 'Assigned',
    inProgress: 'In progress',
    completed: 'Completed',
    /** The booked slot ended and the candidate never started. */
    notAttended: 'Not Attended',
    /** Upper-case form used by the status badges, which print the stored status in capitals. */
    notAttendedBadge: 'NOT ATTENDED',
    slotEnded: 'Time slot ended',
    startInterview: 'Start Interview',
    continueInterview: 'Continue Interview',
    notOpenYet: 'Not open yet',
  },

  /** Assessment (exam paper) states. */
  assessmentStatus: {
    notStarted: 'Not Started',
    completed: 'Completed',
    expired: 'Expired',
  },

  /** Notes written into the results export. */
  exportNotes: {
    aptitudeNotStarted: 'Aptitude not started',
    codingNotStarted: 'Coding not started',
    noCodingPaper: 'No coding paper assigned',
    aptitudeAttempts: (count: number) => `Aptitude attempted ${count} times`,
    codingAttempts: (count: number) => `Coding attempted ${count} times`,
  },

  reschedule: {
    notStarted: (email: string) =>
      `${email} has not started this paper yet. Moving the window changes when they can open it.`,
  },

  /** What the candidate is told once their interview is over, by the reason it ended. */
  interviewEnd: {
    aiClosed:
      'Thank you for your time. The interviewer has finished the interview and your answers have been submitted for review.',
    questionLimit:
      'You have answered all the questions for this interview, so it has been submitted for review. Thank you.',
    timeUp: 'The time allowed for this interview is over, so it was submitted automatically with your answers so far.',
    candidateEnded: 'You ended the interview, so it has been submitted with your answers so far.',
    noResponse:
      'We did not hear from you after several unanswered questions, so the interview was closed and submitted with your answers so far.',
    unknown: 'Your interview has been submitted with your answers so far.',
    other: (reason: string) =>
      `Your interview was submitted automatically: ${reason}. Your answers so far are saved.`,
    submittedTitle: 'Interview submitted',
  },

  /** The "Are you still there?" prompt. */
  stillThere: {
    title: 'Are you still there?',
    confirm: "Yes, I'm still here",
    idle: (maxSkips: number) =>
      `We have not heard an answer yet. Tap the microphone when you are ready. If the time for this question runs out, it will be skipped, and after ${maxSkips} unanswered questions in a row the interview is submitted.`,
    afterSkips: 'Several questions in a row have gone unanswered.',
    afterSilence: 'We have not heard anything for a few minutes.',
    confirmPrompt: 'Please confirm you are still here. If we do not hear from you in',
    consequence: ', the interview will be closed and submitted with your answers so far.',
    closedReason: 'Interview closed: the candidate did not respond to the "are you still there?" prompt',
  },

  /** The score explanation on the interview result page. */
  scoreBreakdown: {
    questionsAsked: 'Questions asked',
    answered: 'Answered',
    skipped: 'Skipped',
    averageAnswerScore: 'Avg answer score',
    averageHint: "Mean of the interviewer's rating of each answer, out of 10",
    howAnswersRated: 'How the answers were rated',
    howOverallBuilt: 'How the overall score is built',
    columns: {
      area: 'Area',
      weight: 'Weight',
      score: 'Score',
      level: 'Level',
      addsToOverall: 'Adds to overall',
    },
    overall: 'Overall',
    formulaNote:
      "Overall = the sum of each area's score × its share of the total weight. Weights are the ones set for this round on the Manage AI Prompts page, taken as shares of their total.",
    fellShort: 'Where the candidate fell short',
    noDetail: 'No detail was recorded for this area.',
    showAnswers: (count: number) => `Show answer-by-answer scores (${count})`,
    hideAnswers: (count: number) => `Hide answer-by-answer scores (${count})`,
    question: 'Question',
    notRated: 'Not rated',
    roundsAttended: 'Rounds attended',
  },

  showMore: 'Show more',
  showLess: 'Show less',

  /** What each performance band means, in the reviewer's terms. Labels and thresholds stay with the bands. */
  performance: {
    outstanding: 'Exceptional command of the subject; answers were accurate, deep and well reasoned.',
    excellent: 'Strong, dependable knowledge with only minor gaps; exceeds what the role requires.',
    good: 'Solid working knowledge; meets the expectations of the role with some areas to strengthen.',
    satisfactory: 'Adequate understanding of the fundamentals, but inconsistent depth or application.',
    needsImprovement: 'Partial understanding; significant gaps for the demands of the role.',
    poor: 'Little evidence of the required knowledge; answers were incorrect, very limited or missing.',
  },
} as const;
