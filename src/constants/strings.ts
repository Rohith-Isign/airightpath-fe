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

  /** Admin → Interview Results list. */
  interviewResults: {
    pageTitle: 'Interview Results',
    pageSubtitle: 'Review AI interview results, evaluation scores, and recordings for each job',
    selectJob: 'Select Job',
    selectJobPlaceholder: 'Select a job',
    round: 'Round',
    allRounds: 'All rounds',
    submittedFrom: 'Submitted from',
    submittedTo: 'Submitted to',
    clear: 'Clear',
    dateRangeInverted: 'The start date is after the end date, so nothing can match. Swap them to see results.',
    stats: {
      totalInterviews: 'Total Interviews',
      passRate: 'Pass Rate',
      avgScore: 'Avg Score',
      avgDuration: 'Avg Duration',
    },
    resultsTitle: (count: number) => `Results (${count})`,
    hideRemoved: 'Hide removed',
    showRemoved: 'Show removed',
    hideRemovedHint: 'Hide results that have been removed',
    showRemovedHint: 'Also list results that have been removed',
    exportExcel: 'Export Excel',
    exportCsv: 'Export CSV',
    exportFailed: 'Could not build the Excel report. Please try again.',
    empty: {
      title: 'No interview results',
      inDateRange: 'No interviews were submitted in this date range. Change or clear the dates to see the others.',
      noneForJob: 'No interviews have been conducted for this job yet.',
      noneForRound: (roundLabel: string) =>
        `No ${roundLabel} interviews for this job yet. Choose "All rounds" to see the others.`,
    },
    notAssessable: 'NOT ASSESSABLE',
    notAssessableHint: 'The interview finished but the candidate did not answer, so there is nothing to score.',
    needsReview: 'Needs review',
    seeRounds: "See this candidate's rounds",
    removedBy: (by: string, reason: string) => `Removed by ${by} — ${reason}`,
    view: 'View',
    unknown: 'unknown',
    noReason: 'no reason recorded',
    recording: { camera: 'Camera', screen: 'Screen', phone: 'Phone' },
    columns: {
      candidate: 'Candidate',
      round: 'Round',
      status: 'Status',
      result: 'Result',
      score: 'Score',
      duration: 'Duration',
      submitted: 'Submitted',
      warnings: 'Warnings',
      completion: 'Completion',
      recommendation: 'Recommendation',
      actions: 'Actions',
    },
    csvHeaders: [
      'Email', 'Round', 'Status', 'Result', 'Completion Reason', 'Score', 'Warnings', 'Duration', 'Submitted',
      'Assigned', 'Deadline',
    ],
  },

  /** Admin → one candidate's interview result page. */
  candidateResult: {
    backFallbackLabel: 'Interview Results',
    backTo: (label: string) => `Back to ${label}`,
    loadFailed: "This candidate's interview results could not be loaded.",
    loadFailedTitle: 'Could not load results',
    noRoundsTitle: 'No interview rounds',
    noRounds: (email: string, job: string) => `${email} has no interview rounds on ${job}.`,
    job: (prefix: string) => `Job: ${prefix}`,
    rounds: (count: number) => `${count} round${count === 1 ? '' : 's'}`,
    attempts: (count: number) => `${count} attempts`,
    attemptsInTotal: (count: number) => `${count} attempts in total`,
    attemptOf: (number: number, count: number) => `Attempt ${number} of ${count}`,
    overallScore: 'Overall score',
    overallScoreHint: 'Mean of the latest scored attempt at each round',
    proctoringWarnings: 'Proctoring warnings',
    timeInInterview: 'Time in interview',
    timeInInterviewHint: 'Summed over every sitting',
    overview: 'Overview',
    interviewFallback: 'Interview',
    score: 'Score',
    notScoredYet: 'Not scored yet',
    duration: 'Duration',
    warnings: 'Warnings',
    questions: 'Questions',
    answered: 'Answered',
    skipped: 'Skipped',
    avgAnswer: 'Avg answer',
    avgAnswerHint: "Mean of the interviewer's per-answer scores",
    scoresByArea: 'Scores by area',
    areasToImprove: 'Areas to improve',
    strengths: 'Strengths',
    transcriptAndScores: 'Transcript and scores',
    download: 'Download',
    downloadFailed: 'Could not build the download. Please try again.',
    pdf: 'PDF',
    pdfHint: 'Watermarked — ready to share',
    excel: 'Excel',
    excelHint: 'Scores and transcript, as data',
    camera: 'Camera',
    sharedScreen: 'Shared screen',
    phone: 'Phone',
    proctoringEvents: (count: number) => `Proctoring events (${count})`,
    nothingFlagged: 'Nothing was flagged during this round.',
    event: 'Event',
    overallAssessment: 'Overall assessment',
    howScoreReached: 'How this score was reached',
    eachAreaWithReasoning: 'Each area, with the reasoning',
    notScored: 'This round has not been scored yet. Scores appear once the interview completes.',
    transcriptTitle: (count: number) => `Transcript (${count})`,
    noTranscript: 'No transcript recorded for this round.',
    recording: {
      phoneStartedNotSaved:
        'started, but no recording was saved. The phone page was probably closed, locked or lost signal before it finished uploading.',
      notRequired: 'not required — switched off by configuration',
      inProgressHint:
        'The interview is still in progress. Recordings are saved in parts while it runs — the first after about ten minutes — and the rest when it ends. Nothing has failed.',
      since: (time: string) => `recording since ${time}`,
      inProgress: 'interview in progress',
      savingAsItRuns: 'saving as it runs',
      neverRecorded: 'never recorded',
      noFailureHint:
        'No failure was reported, so this was most likely never recorded — the candidate may not have been asked to share, or the browser refused.',
    },
    turn: {
      followUp: 'Follow-up',
      rephrased: 'Rephrased',
      triedToInstruct: 'Tried to instruct the interviewer — ignored',
      runOutput: 'Run output',
      wpm: (value: number) => `${value} WPM`,
      confidence: (value: number) => `${value}% confidence`,
    },
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
