import { useState, useEffect } from 'react';
import { useLocation, useNavigate, useParams } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Send, Upload, FileText, X, Loader2, AlertTriangle, CheckCircle, Eye } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/components/ui/Toast';
import { jobApplicationService } from '@/services/job-application.service';
import { jobService } from '@/services/job.service';
import { resumeService } from '@/services/resume.service';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Badge } from '@/components/ui/Badge';
import { ROUTES } from '@/config/routes';
import { jobApplicationSchema, sanitizeExperience } from '@/config/validation';
import { MESSAGES } from '@/config/messages';
import { STRINGS } from '@/constants/strings';
import {
  validateResumeFile,
  filenameFromContentDisposition,
  resumeExtensionForType,
} from '@/utils/file.utils';
import { formatFileSize } from '@/utils/format.utils';
import { digitsOnly } from '@/utils/input.utils';
import type { JobPostDTO, JobApplicationDTO } from '@/types/job.types';

type JobApplicationFormData = z.infer<typeof jobApplicationSchema>;

export function JobApplicationPage() {
  const location = useLocation();
  const navigate = useNavigate();
  const { user } = useAuth();
  const { showToast } = useToast();

  const { jobPrefix: paramPrefix } = useParams<{ jobPrefix: string }>();

  const locationState = location.state as {
    job?: JobPostDTO;
    existingApplication?: JobApplicationDTO;
  } | null;
  const passedApplication = locationState?.existingApplication;

  // Job comes either from in-app navigation state or, for a shared link, is
  // resolved from the :jobPrefix URL param.
  const [job, setJob] = useState<JobPostDTO | null>(locationState?.job ?? null);
  const [resolvingJob, setResolvingJob] = useState(!locationState?.job && !!paramPrefix);
  const [jobNotFound, setJobNotFound] = useState(false);

  const [submitting, setSubmitting] = useState(false);
  const [loading, setLoading] = useState(false);
  const [resumeFile, setResumeFile] = useState<File | null>(null);
  /** The resume already held for this candidate, if any. */
  const [storedResume, setStoredResume] = useState<File | null>(null);
  const [checkingStored, setCheckingStored] = useState(false);
  const [resumeSource, setResumeSource] = useState<'existing' | 'upload'>('upload');
  const [isEditMode, setIsEditMode] = useState(false);
  const [existingApplication, setExistingApplication] = useState<JobApplicationDTO | null>(null);
  const [isDeadlinePassed, setIsDeadlinePassed] = useState(false);

  const {
    register,
    handleSubmit,
    reset,
    setValue,
    formState: { errors },
  } = useForm<JobApplicationFormData>({
    resolver: zodResolver(jobApplicationSchema),
    defaultValues: {
      firstName: user?.firstName || '',
      lastName: user?.lastName || '',
      email: user?.email || '',
      mobileNumber: user?.mobileNumber || '',
      experience: '',
      address: '',
      role: job?.role || job?.jobTitle || '',
      referralName: '',
      referralId: '',
    },
  });

  // Resolve the job from the URL param for shared apply links (no nav state).
  useEffect(() => {
    let cancelled = false;
    async function resolveJob() {
      if (job || !paramPrefix) return;
      setResolvingJob(true);
      setJobNotFound(false);
      try {
        const res = await jobService.getAllJobs();
        const match = res.data?.find((j) => j.jobPrefix === paramPrefix);
        if (cancelled) return;
        if (match) {
          setJob(match);
          // Prefill the role for a fresh application (edit mode overrides later).
          setValue('role', match.role || match.jobTitle || '');
        } else {
          setJobNotFound(true);
        }
      } catch {
        if (!cancelled) setJobNotFound(true);
      } finally {
        if (!cancelled) setResolvingJob(false);
      }
    }
    resolveJob();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [paramPrefix]);

  /** The role the job itself names; empty when the posting has neither a role nor a title. */
  const jobRole = job?.role?.trim() || job?.jobTitle?.trim() || '';

  // The role always follows the job on a new application (edit mode fills it from the saved application).
  useEffect(() => {
    if (job && !isEditMode) setValue('role', job.role || job.jobTitle || '');
  }, [job, isEditMode, setValue]);

  // Check deadline
  useEffect(() => {
    if (job?.applicationDeadline) {
      const deadline = new Date(job.applicationDeadline);
      const today = new Date(new Date().toDateString());
      if (deadline < today) {
        setIsDeadlinePassed(true);
      }
    }
  }, [job?.applicationDeadline]);

  // Check for existing application - use passed data or fetch from API
  useEffect(() => {
    async function checkExisting() {
      if (!job?.jobPrefix || !user?.email) return;

      // If application data was passed from MyApplicationsPage, use it
      if (passedApplication) {
        setExistingApplication(passedApplication);
        setIsEditMode(true);
        reset({
          firstName: passedApplication.firstName,
          lastName: passedApplication.lastName,
          email: passedApplication.email || passedApplication.userEmail || user.email,
          mobileNumber: passedApplication.mobileNumber,
          experience: passedApplication.experience,
          address: passedApplication.address,
          role: passedApplication.jobRole,
        });
        return;
      }

      // Otherwise, fetch from API
      setLoading(true);
      try {
        const res = await jobApplicationService.getByPrefixAndEmail(job.jobPrefix, user.email);
        if (res.data) {
          setExistingApplication(res.data);
          setIsEditMode(true);
          reset({
            firstName: res.data.firstName,
            lastName: res.data.lastName,
            email: res.data.email || res.data.userEmail || user.email,
            mobileNumber: res.data.mobileNumber,
            experience: res.data.experience,
            address: res.data.address,
            role: res.data.jobRole,
          });
        }
      } catch {
        // No existing application - that's fine
      } finally {
        setLoading(false);
      }
    }
    checkExisting();
  }, [job?.jobPrefix, user?.email, reset, passedApplication]);

  /**
   * Look for a resume already held for this candidate (uploaded on the Resume
   * page or with an earlier application) so they can reuse it instead of
   * hunting for the file again.
   *
   * There is no metadata endpoint, so this fetches the file itself — which is
   * also what lets the form submit it without a second round trip. Capped at
   * 2 MB by the upload rules. A 400/404 just means nothing is stored.
   */
  useEffect(() => {
    // Captured so the async closure keeps the narrowed value.
    const email = user?.email;
    if (!email) return;
    let cancelled = false;

    (async () => {
      setCheckingStored(true);
      try {
        const res = await resumeService.view(email, { _skipErrorToast: true });
        const blob = res.data;
        if (cancelled || !blob || blob.size === 0) return;

        const headers = res.headers as Record<string, string> | undefined;
        const name =
          filenameFromContentDisposition(headers?.['content-disposition']) ??
          `${email}-resume${resumeExtensionForType(blob.type)}`;

        setStoredResume(new File([blob], name, { type: blob.type || 'application/pdf' }));
      } catch {
        // No resume on file — the upload box is the only option.
      } finally {
        // Cleared even if this run was superseded, otherwise the "checking..."
        // line sticks around forever.
        setCheckingStored(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [user?.email]);

  // Reusing the saved resume is the common case when applying fresh. Kept out
  // of the fetch so it can't fire before edit mode is known.
  useEffect(() => {
    if (!isEditMode && storedResume && !resumeFile) setResumeSource('existing');
  }, [isEditMode, storedResume, resumeFile]);

  /** Opens the stored resume in a new tab; no await, so no popup blocking. */
  const previewStoredResume = () => {
    if (!storedResume) return;
    const url = URL.createObjectURL(storedResume);
    window.open(url, '_blank', 'noopener');
    // The tab keeps its own reference; release ours once it has loaded.
    setTimeout(() => URL.revokeObjectURL(url), 60_000);
  };

  const handleResumeSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const error = validateResumeFile(file);
    if (error) {
      showToast(error, 'error');
      return;
    }
    setResumeFile(file);
    setResumeSource('upload');
  };

  const onSubmit = async (data: JobApplicationFormData) => {
    if (!job?.jobPrefix) {
      showToast(MESSAGES.application.noJobSelected, 'error');
      return;
    }

    // Either the file just picked, or the one already on file. Editing only
    // ever sends a deliberately picked file — the stored one stays put.
    const chosenResume =
      !isEditMode && resumeSource === 'existing' ? storedResume : resumeFile;

    if (!isEditMode && !chosenResume) {
      showToast(MESSAGES.application.resumeRequired, 'warning');
      return;
    }

    setSubmitting(true);
    try {
      const jobApplication = JSON.stringify({
        firstName: data.firstName,
        lastName: data.lastName,
        email: data.email,
        mobileNumber: data.mobileNumber,
        experience: data.experience,
        address: data.address,
        // A disabled field can come back empty from the form, so the job's own role is the fallback.
        jobRole: data.role || jobRole,
        jobPrefix: job.jobPrefix,
      });

      const formData = new FormData();
      formData.append('jobApplication', new Blob([jobApplication], { type: 'application/json' }));

      if (chosenResume) {
        formData.append('resume', chosenResume);
      }

      // Optional referral — sent as separate form parts (keys are case-sensitive),
      // and only when the candidate actually entered a value. Captured at apply
      // time only; the update endpoint ignores these fields.
      if (!isEditMode) {
        const referralName = data.referralName?.trim();
        const referralId = data.referralId?.trim();
        if (referralName) formData.append('referralName', referralName);
        if (referralId) formData.append('referralId', referralId);
      }

      if (isEditMode) {
        await jobApplicationService.update(formData);
        showToast(MESSAGES.application.updated, 'success');
      } else {
        await jobApplicationService.apply(formData);
        showToast(MESSAGES.application.submitted, 'success');
      }

      navigate(ROUTES.CANDIDATE.APPLICATIONS);
    } catch {
      // Error toast auto-handled by interceptor
    } finally {
      setSubmitting(false);
    }
  };

  // Resolving a shared link's job by prefix.
  if (resolvingJob) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <Loader2 className="w-8 h-8 animate-spin text-[var(--primary)]" />
      </div>
    );
  }

  if (!job) {
    return (
      <div className="text-center py-16">
        <p className="text-lg text-[var(--textSecondary)]">
          {jobNotFound
            ? STRINGS.applyForm.jobNotFound
            : STRINGS.applyForm.noJobSelected}
        </p>
        <Button className="mt-4" onClick={() => navigate(ROUTES.CANDIDATE.EVENTS)}>
          {STRINGS.applyForm.browseJobs}
        </Button>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <Loader2 className="w-8 h-8 animate-spin text-[var(--primary)]" />
      </div>
    );
  }

  // A submitted application is final: there is no form to change it, only the list to look at it.
  if (isEditMode) {
    return (
      <div className="max-w-2xl mx-auto py-16 text-center">
        <CheckCircle className="w-12 h-12 mx-auto text-[var(--success)] mb-4" />
        <h1 className="text-2xl font-bold text-[var(--text)]">{STRINGS.applyForm.alreadyAppliedTitle}</h1>
        <p className="mt-2 text-[var(--textSecondary)]">
          {STRINGS.applyForm.alreadyAppliedBody(job.jobTitle, job.companyName)}
        </p>
        <Button className="mt-6" onClick={() => navigate(ROUTES.CANDIDATE.APPLICATIONS)}>
          {STRINGS.applyForm.viewMyApplications}
        </Button>
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-[var(--text)]">
          {isEditMode ? STRINGS.applyForm.titleUpdate : STRINGS.applyForm.titleApply}
        </h1>
        <p className="mt-1 text-[var(--textSecondary)]">
          {STRINGS.applyForm.atCompany(job.jobTitle, job.companyName)}
        </p>
        {isEditMode && existingApplication?.status && (
          <div className="mt-2 flex items-center gap-2">
            <span className="text-sm text-[var(--textSecondary)]">{STRINGS.applyForm.currentStatus}</span>
            <Badge
              variant={
                existingApplication.status === 'APPLIED' ? 'info' :
                existingApplication.status === 'SHORTLISTED' ? 'success' :
                existingApplication.status === 'REJECTED' ? 'error' : 'primary'
              }
              size="sm"
            >
              {existingApplication.status}
            </Badge>
          </div>
        )}
      </div>

      {isDeadlinePassed && (
        <div className="flex items-center gap-3 p-4 rounded-lg bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800">
          <AlertTriangle className="w-5 h-5 text-red-500 flex-shrink-0" />
          <p className="text-sm text-red-700 dark:text-red-400">
            {STRINGS.applyForm.deadlinePassed}
          </p>
        </div>
      )}

      <Card>
        <CardHeader>
          <CardTitle>{STRINGS.applyForm.formTitle}</CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
            <p className="text-xs text-[var(--textSecondary)]">
              {STRINGS.applyForm.requiredNote}
            </p>
            {/* The role comes from the job being applied to, so it is shown first and cannot be edited. It is
                disabled like Email; the submit falls back to the job's role. A job that
                names no role leaves the field open, so the candidate can still say what they are applying as. */}
            <Input
              label={STRINGS.applyForm.role}
              {...register('role')}
              error={errors.role?.message}
              // Disabled exactly like Email, so the two fixed fields look and behave the same.
              disabled={!!jobRole}
              autoComplete="off"
              placeholder={jobRole ? undefined : STRINGS.applyForm.rolePlaceholder}
              helperText={jobRole ? STRINGS.applyForm.roleFromJob : undefined}
            />

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <Input
                label={STRINGS.applyForm.firstName}
                required
                {...register('firstName')}
                error={errors.firstName?.message}
              />
              <Input
                label={STRINGS.applyForm.lastName}
                required
                {...register('lastName')}
                error={errors.lastName?.message}
              />
            </div>

            <Input
              label={STRINGS.applyForm.email}
              required
              type="email"
              {...register('email')}
              error={errors.email?.message}
              disabled={!!user?.email}
            />

            <Input
              label={STRINGS.applyForm.mobile}
              required
              type="tel"
              inputMode="numeric"
              maxLength={10}
              autoComplete="tel"
              placeholder={STRINGS.applyForm.mobilePlaceholder}
              error={errors.mobileNumber?.message}
              {...register('mobileNumber')}
              onChange={(e) =>
                setValue('mobileNumber', digitsOnly(e.target.value), {
                  shouldValidate: true,
                  shouldDirty: true,
                })
              }
            />

            <Input
              label={STRINGS.applyForm.experience}
              required
              {...register('experience')}
              onChange={(e) => {
                e.target.value = sanitizeExperience(e.target.value);
                void register('experience').onChange(e);
              }}
              error={errors.experience?.message}
              placeholder={STRINGS.applyForm.experiencePlaceholder}
            />

            <Input
              label={STRINGS.applyForm.address}
              required
              {...register('address')}
              error={errors.address?.message}
              placeholder={STRINGS.applyForm.addressPlaceholder}
            />

            {/* Referral — editable on a new application; read-only when editing
                (referral is captured at apply time only and never sent on update). */}
            {!isEditMode ? (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <Input
                  label={STRINGS.applyForm.referralName}
                  helperText={STRINGS.applyForm.optional}
                  placeholder={STRINGS.applyForm.referralNamePlaceholder}
                  error={errors.referralName?.message}
                  {...register('referralName')}
                />
                <Input
                  label={STRINGS.applyForm.referralId}
                  helperText={STRINGS.applyForm.optional}
                  placeholder={STRINGS.applyForm.referralIdPlaceholder}
                  error={errors.referralId?.message}
                  {...register('referralId')}
                />
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <Input
                  label={STRINGS.applyForm.referralName}
                  value={existingApplication?.referralName?.trim() || STRINGS.applyForm.notProvided}
                  readOnly
                  disabled
                  helperText={STRINGS.applyForm.referralLocked}
                />
                <Input
                  label={STRINGS.applyForm.referralId}
                  value={existingApplication?.referralId?.trim() || STRINGS.applyForm.notProvided}
                  readOnly
                  disabled
                />
              </div>
            )}

            {/* Resume Upload */}
            <div className="space-y-2">
              <label className="block text-sm font-medium text-[var(--text)]">
                {STRINGS.applyForm.resume} {!isEditMode && <span className="text-[var(--error)]">*</span>}
              </label>

              {/* Show existing resume info in edit mode */}
              {isEditMode && !resumeFile && existingApplication?.resumeFileName && (
                <div className="flex flex-wrap items-center gap-3 p-3 rounded-lg bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800">
                  <CheckCircle className="w-5 h-5 text-green-500 flex-shrink-0" />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-green-700 dark:text-green-400">
                      {STRINGS.applyForm.resumeAlreadyUploaded}
                    </p>
                    <p className="text-xs text-green-600 dark:text-green-500 truncate">
                      {existingApplication.resumeFileName}
                    </p>
                  </div>
                  {/* The saved file is fetched in the background; the button
                      waits for it rather than pretending to be inert. */}
                  <button
                    type="button"
                    onClick={previewStoredResume}
                    disabled={!storedResume}
                    className="inline-flex items-center gap-1.5 text-sm font-medium text-green-700 dark:text-green-400 hover:underline disabled:opacity-50 disabled:cursor-not-allowed disabled:no-underline flex-shrink-0"
                  >
                    {storedResume ? (
                      <>
                        <Eye size={14} />
                        {STRINGS.applyForm.view}
                      </>
                    ) : (
                      <>
                        <Loader2 size={14} className="animate-spin" />
                        {STRINGS.applyForm.loading}
                      </>
                    )}
                  </button>
                </div>
              )}

              {/* Checking whether a resume is already on file */}
              {checkingStored && !isEditMode && (
                <p className="flex items-center gap-2 text-sm text-[var(--textSecondary)]">
                  <Loader2 size={14} className="animate-spin" />
                  {STRINGS.applyForm.checkingSaved}
                </p>
              )}

              {/* Reuse the resume already held, or upload a fresh one */}
              {!isEditMode && storedResume && (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <button
                    type="button"
                    onClick={() => setResumeSource('existing')}
                    className={`text-left p-3 rounded-xl border-2 transition-colors ${
                      resumeSource === 'existing'
                        ? 'border-[var(--primary)] bg-[var(--primaryMuted,var(--primaryLight))]'
                        : 'border-[var(--border)] hover:border-[var(--borderHover,var(--border))]'
                    }`}
                  >
                    <span className="flex items-center gap-2">
                      <FileText size={16} className="text-[var(--primary)] flex-shrink-0" />
                      <span className="text-sm font-medium text-[var(--text)]">
                        {STRINGS.applyForm.useSaved}
                      </span>
                    </span>
                    <span className="block text-xs text-[var(--textSecondary)] mt-1 truncate">
                      {storedResume.name}
                    </span>
                    <span className="block text-xs text-[var(--textTertiary)]">
                      {formatFileSize(storedResume.size)}
                    </span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setResumeSource('upload')}
                    className={`text-left p-3 rounded-xl border-2 transition-colors ${
                      resumeSource === 'upload'
                        ? 'border-[var(--primary)] bg-[var(--primaryMuted,var(--primaryLight))]'
                        : 'border-[var(--border)] hover:border-[var(--borderHover,var(--border))]'
                    }`}
                  >
                    <span className="flex items-center gap-2">
                      <Upload size={16} className="text-[var(--primary)] flex-shrink-0" />
                      <span className="text-sm font-medium text-[var(--text)]">
                        {STRINGS.applyForm.uploadDifferent}
                      </span>
                    </span>
                    <span className="block text-xs text-[var(--textSecondary)] mt-1">
                      {STRINGS.applyForm.fromDevice}
                    </span>
                  </button>
                </div>
              )}

              {/* Confirmation of the saved resume, with a way to check it */}
              {!isEditMode && storedResume && resumeSource === 'existing' && (
                <div className="flex flex-wrap items-center justify-between gap-2 p-3 rounded-lg bg-[var(--surface1)] border border-[var(--border)]">
                  <span className="flex items-center gap-2 min-w-0">
                    <CheckCircle size={16} className="text-[var(--success)] flex-shrink-0" />
                    <span className="text-sm text-[var(--text)] truncate">
                      {STRINGS.applyForm.applyingWith} <strong>{storedResume.name}</strong>
                    </span>
                  </span>
                  <button
                    type="button"
                    onClick={previewStoredResume}
                    className="inline-flex items-center gap-1.5 text-sm font-medium text-[var(--primary)] hover:underline flex-shrink-0"
                  >
                    <Eye size={14} />
                    {STRINGS.applyForm.preview}
                  </button>
                </div>
              )}

              {/* Upload box — the only option when nothing is on file */}
              {(isEditMode || !storedResume || resumeSource === 'upload') && (
                <>
                  <div
                    className="border-2 border-dashed border-[var(--border)] rounded-lg p-6 text-center cursor-pointer hover:border-[var(--primary)] transition-colors"
                onClick={() => document.getElementById('app-resume-input')?.click()}
              >
                <input
                  id="app-resume-input"
                  type="file"
                  accept=".pdf,.doc,.docx"
                  className="hidden"
                  onChange={handleResumeSelect}
                />
                <Upload className="w-8 h-8 mx-auto text-[var(--textTertiary)] mb-2" />
                <p className="text-sm text-[var(--textSecondary)]">
                  {isEditMode
                    ? STRINGS.applyForm.uploadReplace
                    : STRINGS.applyForm.upload}
                </p>
              </div>
              {resumeFile && (
                <div className="flex items-center justify-between p-3 rounded-lg bg-[var(--surface1)] border border-[var(--border)]">
                  <div className="flex items-center gap-2 min-w-0">
                    <FileText className="w-4 h-4 text-[var(--primary)] flex-shrink-0" />
                    <span className="text-sm text-[var(--text)] truncate">{resumeFile.name}</span>
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      setResumeFile(null);
                      // Fall back to the saved resume rather than to nothing.
                      if (storedResume) setResumeSource('existing');
                    }}
                    className="text-[var(--textSecondary)] hover:text-[var(--text)] flex-shrink-0"
                  >
                    <X size={16} />
                  </button>
                </div>
                  )}
                </>
              )}
            </div>

            <div className="flex justify-end gap-3 pt-4">
              <Button
                variant="outline"
                type="button"
                onClick={() => navigate(-1)}
              >
                {STRINGS.applyForm.cancel}
              </Button>
              <Button
                type="submit"
                isLoading={submitting}
                disabled={isDeadlinePassed}
                leftIcon={<Send size={18} />}
              >
                {isDeadlinePassed
                  ? STRINGS.applyForm.deadlinePassedButton
                  : isEditMode
                    ? STRINGS.applyForm.titleUpdate
                    : STRINGS.applyForm.submit}
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
