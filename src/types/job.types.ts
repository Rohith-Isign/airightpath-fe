export interface JobPostDTO {
  id?: number;
  jobPrefix: string;
  jobTitle: string;
  companyName: string;
  location: string;
  jobDescription: string;
  keySkills: string;
  experience: string;
  education: string;
  salaryRange?: string;
  jobType: string;
  industry?: string;
  department?: string;
  role?: string;
  numberOfOpenings: number;
  contactEmail?: string;
  applicationDeadline: string;
  createdAt?: string;
  updatedAt?: string;
}

// ── ATS screening run (POST /api/job-applications/screen) ────────────

/**
 * One candidate's outcome from a screening run.
 *
 * `screened: false` is an outcome, not a failure — the row was scored but not
 * saved, and `reason` explains why in words meant to be shown as-is.
 * `status: null` with `screened: false` means no application exists for that
 * email.
 */
export interface ScreeningResultRow {
  email: string;
  fullName?: string;
  matchPercent?: number;
  status?: JobApplicationStatus | null;
  screened: boolean;
  reason?: string | null;
}

/** One part of an ATS score (GET /api/job-applications/{id}/score-breakdown). */
export interface ScoreBreakdownPart {
  name: string;
  /** How well the resume does on this part, 0 to 100. */
  score: number;
  /** This part's share of the total, in percent; the shares add to 100. */
  weight: number;
  /** What this part adds to the final score. */
  points: number;
  note: string;
}

/** Why a candidate's ATS score is what it is. `percent` is null when the resume could not be read (see `note`). */
export interface ScoreBreakdown {
  percent: number | null;
  /** The score saved by the last screening run; differs from `percent` if the job or resume changed since. */
  storedPercent: number | null;
  threshold: number;
  parts: ScoreBreakdownPart[];
  matchedSkills: string[];
  missingSkills: string[];
  note: string | null;
}

export interface ScreeningRun {
  jobPrefix: string;
  /** Shortlist cut-off the run used, as a percentage. */
  threshold?: number;
  scope?: 'ALL' | 'SELECTED';
  screenedCount: number;
  skippedCount: number;
  notFoundCount: number;
  shortlistedCount: number;
  rejectedCount: number;
  message?: string;
  results: ScreeningResultRow[];
}

export type JobApplicationStatus =
  | 'APPLIED'
  | 'SHORTLISTED'
  | 'ACKNOWLEDGED'
  | 'ACKNOWLEDGED_BACK'
  | 'RECONFIRMED'
  | 'EXAM_SENT'
  | 'EXAM_COMPLETED'
  | 'INTERVIEW_SCHEDULED'
  | 'INTERVIEW_COMPLETED'
  | 'SELECTED'
  | 'REJECTED';

export interface JobApplicationDTO {
  id?: number;
  firstName: string;
  lastName: string;
  email: string;
  userEmail?: string;
  mobileNumber: string;
  experience: string;
  address: string;
  jobRole: string;
  jobPrefix: string;
  status: JobApplicationStatus;
  resumeFileName?: string;
  contentType?: string;
  matchPercent?: number;
  /** ATS shortlisting outcome, e.g. "Shortlisted" / "Not Shortlisted". */
  shortlistStatus?: string;
  /** Whether the ATS scan has run, e.g. "Screening Completed" / "Pending". */
  atsScanStatus?: string;
  confirmationStatus?: string;
  acknowledgedStatus?: string;
  reconfirmationStatus?: string;
  examLinkStatus?: string;
  examCompletedStatus?: string;
  rejectionStatus?: string;
  writtenTestStatus?: string;
  interview?: string;
  createdAt?: string;
  updatedAt?: string;
  jobTitle?: string;
  companyName?: string;
  applicationDeadline?: string;
  /** Optional referral captured at apply time (either may be null). */
  referralId?: string | null;
  referralName?: string | null;
  /** Admin validation of the referral: PENDING | VALIDATED | REJECTED (or null). */
  referralStatus?: string | null;
}
