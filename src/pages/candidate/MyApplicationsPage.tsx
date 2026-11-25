import { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Search,
  Briefcase,
  Building2,
  Calendar,
  Loader2,
  FileText,
  ExternalLink,
  MapPin,
  Clock,
  User,
  Phone,
  Mail,
  Tag,
  UserPlus,
} from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { STRINGS } from '@/constants/strings';
import { jobApplicationService } from '@/services/job-application.service';
import { Card, CardContent } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { Input } from '@/components/ui/Input';
import { Select } from '@/components/ui/Select';
import { Modal } from '@/components/ui/Modal';
import { ROUTES } from '@/config/routes';
import { formatDate } from '@/utils/format.utils';
import { usePersistentState } from '@/hooks/usePersistentState';
import { hasReferral } from '@/utils/referral.utils';
import { ReferralFields } from '@/components/application/ReferralFields';
import { ResumeViewerModal } from '@/components/admin/ResumeViewerModal';
import { useResumeViewer } from '@/hooks/useResumeViewer';
import type { JobApplicationDTO } from '@/types/job.types';

const STATUS_CONFIG: Record<
  string,
  { label: string; variant: 'default' | 'success' | 'warning' | 'error' | 'info' | 'primary' | 'secondary' }
> = {
  APPLIED: { label: STRINGS.myApplications.statusLabels.APPLIED, variant: 'info' },
  SHORTLISTED: { label: STRINGS.myApplications.statusLabels.SHORTLISTED, variant: 'success' },
  ACKNOWLEDGED: { label: STRINGS.myApplications.statusLabels.ACKNOWLEDGED, variant: 'primary' },
  ACKNOWLEDGED_BACK: { label: STRINGS.myApplications.statusLabels.ACKNOWLEDGED_BACK, variant: 'primary' },
  RECONFIRMED: { label: STRINGS.myApplications.statusLabels.RECONFIRMED, variant: 'primary' },
  EXAM_SENT: { label: STRINGS.myApplications.statusLabels.EXAM_SENT, variant: 'warning' },
  EXAM_COMPLETED: { label: STRINGS.myApplications.statusLabels.EXAM_COMPLETED, variant: 'info' },
  INTERVIEW_SCHEDULED: { label: STRINGS.myApplications.statusLabels.INTERVIEW_SCHEDULED, variant: 'primary' },
  INTERVIEW_COMPLETED: { label: STRINGS.myApplications.statusLabels.INTERVIEW_COMPLETED, variant: 'info' },
  SELECTED: { label: STRINGS.myApplications.statusLabels.SELECTED, variant: 'success' },
  REJECTED: { label: STRINGS.myApplications.statusLabels.REJECTED, variant: 'error' },
};

function getStatusBadge(status: string | undefined) {
  const config = STATUS_CONFIG[status ?? ''] ?? { label: status ?? STRINGS.myApplications.unknownStatus, variant: 'default' as const };
  return <Badge variant={config.variant} size="sm">{config.label}</Badge>;
}

export function MyApplicationsPage() {
  const navigate = useNavigate();
  const { user } = useAuth();

  const [applications, setApplications] = useState<JobApplicationDTO[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = usePersistentState('myApplications:searchQuery', '');
  const [filterStatus, setFilterStatus] = usePersistentState('myApplications:filterStatus', '');
  const [selectedApp, setSelectedApp] = useState<JobApplicationDTO | null>(null);
  // The resume sent with an application, opened from its details.
  const resumeViewer = useResumeViewer();

  useEffect(() => {
    async function fetchApplications() {
      if (!user?.email) return;
      setLoading(true);
      try {
        const res = await jobApplicationService.getByEmail(user.email);
        setApplications(res.data ?? []);
      } catch {
        // Error toast auto-handled by interceptor
      } finally {
        setLoading(false);
      }
    }
    fetchApplications();
  }, [user?.email]);

  const statuses = useMemo(() => {
    const set = new Set(applications.map((a) => a.status).filter(Boolean));
    return Array.from(set);
  }, [applications]);

  const filteredApplications = useMemo(() => {
    // Newest first: the application made last is the first one listed. The id breaks ties and stands in when a
    // row has no creation time.
    const newestFirst = [...applications].sort((a, b) => {
      const byTime = (Date.parse(b.createdAt ?? '') || 0) - (Date.parse(a.createdAt ?? '') || 0);
      return byTime || (b.id ?? 0) - (a.id ?? 0);
    });
    return newestFirst.filter((app) => {
      const matchesSearch =
        !searchQuery ||
        (app.jobTitle ?? '').toLowerCase().includes(searchQuery.toLowerCase()) ||
        (app.companyName ?? '').toLowerCase().includes(searchQuery.toLowerCase()) ||
        app.jobPrefix.toLowerCase().includes(searchQuery.toLowerCase());

      const matchesStatus = !filterStatus || app.status === filterStatus;

      return matchesSearch && matchesStatus;
    });
  }, [applications, searchQuery, filterStatus]);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <Loader2 className="w-8 h-8 animate-spin text-[var(--primary)]" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-[var(--text)]">{STRINGS.myApplications.title}</h1>
        <p className="mt-1 text-[var(--textSecondary)]">
          {STRINGS.myApplications.subtitle}
        </p>
      </div>

      {/* Search and Filter */}
      <div className="flex flex-col sm:flex-row gap-4">
        <div className="flex-1">
          <Input
            placeholder={STRINGS.myApplications.searchPlaceholder}
            leftIcon={<Search size={18} />}
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>
        <div className="sm:w-48">
          <Select
            options={[
              { value: '', label: STRINGS.myApplications.allStatuses },
              ...statuses.map((status) => ({
                value: status,
                label: STATUS_CONFIG[status]?.label ?? status,
              })),
            ]}
            value={filterStatus}
            onChange={(e) => setFilterStatus(e.target.value)}
          />
        </div>
      </div>

      {/* Results Count */}
      <p className="text-sm text-[var(--textSecondary)]">
        {STRINGS.myApplications.showing(filteredApplications.length, applications.length)}
      </p>

      {/* Applications List */}
      {filteredApplications.length === 0 ? (
        <div className="text-center py-16">
          <FileText className="w-12 h-12 mx-auto text-[var(--textTertiary)] mb-4" />
          <p className="text-lg font-medium text-[var(--text)]">
            {applications.length === 0 ? STRINGS.myApplications.emptyTitle : STRINGS.myApplications.noMatchTitle}
          </p>
          <p className="text-[var(--textSecondary)] mt-1">
            {applications.length === 0
              ? STRINGS.myApplications.emptyBody
              : STRINGS.myApplications.noMatchBody}
          </p>
          {applications.length === 0 && (
            <Button className="mt-4" onClick={() => navigate(ROUTES.CANDIDATE.EVENTS)}>
              {STRINGS.myApplications.browseJobs}
            </Button>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredApplications.map((app) => (
            <Card key={app.id ?? `${app.jobPrefix}-${app.email}`} hover>
              <CardContent>
                <div className="space-y-4">
                  {/* Job Title and Company */}
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <h3 className="text-lg font-semibold text-[var(--text)] truncate">
                        {app.jobTitle ?? app.jobPrefix}
                      </h3>
                      {app.companyName && (
                        <div className="flex items-center gap-1.5 mt-0.5">
                          <Building2 size={13} className="text-[var(--textTertiary)] flex-shrink-0" />
                          <span className="text-sm text-[var(--textSecondary)] truncate">
                            {app.companyName}
                          </span>
                        </div>
                      )}
                    </div>
                    {getStatusBadge(app.status)}
                  </div>

                  {/* Details */}
                  <div className="space-y-2">
                    <div className="flex items-center gap-2 text-sm text-[var(--textSecondary)]">
                      <Briefcase size={14} className="flex-shrink-0" />
                      <span>{STRINGS.myApplications.ref(app.jobPrefix)}</span>
                    </div>
                    {app.jobRole && (
                      <div className="flex items-center gap-2 text-sm text-[var(--textSecondary)]">
                        <Tag size={14} className="flex-shrink-0" />
                        <span>{STRINGS.myApplications.role(app.jobRole)}</span>
                      </div>
                    )}
                    {app.applicationDeadline && (
                      <div className="flex items-center gap-2 text-sm text-[var(--textSecondary)]">
                        <Calendar size={14} className="flex-shrink-0" />
                        <span>{STRINGS.myApplications.deadline(formatDate(app.applicationDeadline))}</span>
                      </div>
                    )}
                    {app.resumeFileName && (
                      <div className="flex items-center gap-2 text-sm text-[var(--textSecondary)]">
                        <FileText size={14} className="flex-shrink-0" />
                        <span className="truncate">{STRINGS.myApplications.resume(app.resumeFileName)}</span>
                      </div>
                    )}
                    {hasReferral(app.referralName, app.referralId) && (
                      <div className="flex items-center gap-2 text-sm text-[var(--textSecondary)]">
                        <UserPlus size={14} className="flex-shrink-0" />
                        <span className="truncate">
                          {STRINGS.myApplications.referral(app.referralName?.trim() || app.referralId?.trim() || '')}
                        </span>
                      </div>
                    )}
                  </div>

                  {/* Action Buttons */}
                  <div className="flex gap-2">
                    <Button
                      variant="outline"
                      className="flex-1"
                      onClick={() => setSelectedApp(app)}
                      leftIcon={<ExternalLink size={16} />}
                    >
                      {STRINGS.myApplications.view}
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Application Details Modal */}
      {selectedApp && (
        <Modal
          isOpen={!!selectedApp}
          onClose={() => setSelectedApp(null)}
          title={STRINGS.myApplications.detailsTitle}
          size="lg"
          footer={
            <>
              <Button variant="ghost" onClick={() => setSelectedApp(null)}>
                {STRINGS.myApplications.close}
              </Button>
            </>
          }
        >
          <div className="space-y-6">
            {/* Header */}
            <div className="flex items-start justify-between gap-4">
              <div>
                <h3 className="text-xl font-bold text-[var(--text)]">
                  {selectedApp.jobTitle ?? selectedApp.jobPrefix}
                </h3>
                {selectedApp.companyName && (
                  <div className="flex items-center gap-2 mt-1">
                    <Building2 size={16} className="text-[var(--textTertiary)]" />
                    <span className="text-[var(--textSecondary)]">{selectedApp.companyName}</span>
                  </div>
                )}
              </div>
              <div className="flex flex-col items-end gap-1">
                <Badge variant="primary" size="sm">{selectedApp.jobPrefix}</Badge>
                {getStatusBadge(selectedApp.status)}
              </div>
            </div>

            {/* Personal Information */}
            <div>
              <h4 className="text-sm font-semibold text-[var(--text)] mb-3">{STRINGS.myApplications.personalInformation}</h4>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="flex items-center gap-2 text-sm">
                  <User size={16} className="text-[var(--primary)] flex-shrink-0" />
                  <div>
                    <p className="text-[var(--textTertiary)] text-xs">{STRINGS.myApplications.fullName}</p>
                    <p className="text-[var(--text)] font-medium">
                      {selectedApp.firstName} {selectedApp.lastName}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-2 text-sm">
                  <Mail size={16} className="text-[var(--primary)] flex-shrink-0" />
                  <div>
                    <p className="text-[var(--textTertiary)] text-xs">{STRINGS.myApplications.email}</p>
                    <p className="text-[var(--text)] font-medium">
                      {selectedApp.email || selectedApp.userEmail}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-2 text-sm">
                  <Phone size={16} className="text-[var(--primary)] flex-shrink-0" />
                  <div>
                    <p className="text-[var(--textTertiary)] text-xs">{STRINGS.myApplications.mobile}</p>
                    <p className="text-[var(--text)] font-medium">
                      {selectedApp.mobileNumber || STRINGS.myApplications.notAvailable}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-2 text-sm">
                  <Clock size={16} className="text-[var(--primary)] flex-shrink-0" />
                  <div>
                    <p className="text-[var(--textTertiary)] text-xs">{STRINGS.myApplications.experience}</p>
                    <p className="text-[var(--text)] font-medium">{selectedApp.experience}</p>
                  </div>
                </div>
                <div className="flex items-center gap-2 text-sm">
                  <MapPin size={16} className="text-[var(--primary)] flex-shrink-0" />
                  <div>
                    <p className="text-[var(--textTertiary)] text-xs">{STRINGS.myApplications.address}</p>
                    <p className="text-[var(--text)] font-medium">{selectedApp.address}</p>
                  </div>
                </div>
                <div className="flex items-center gap-2 text-sm">
                  <Briefcase size={16} className="text-[var(--primary)] flex-shrink-0" />
                  <div>
                    <p className="text-[var(--textTertiary)] text-xs">{STRINGS.myApplications.appliedRole}</p>
                    <p className="text-[var(--text)] font-medium">{selectedApp.jobRole}</p>
                  </div>
                </div>
                <ReferralFields
                  referralName={selectedApp.referralName}
                  referralId={selectedApp.referralId}
                  alwaysShow
                />
              </div>
            </div>

            {/* Application Status */}
            <div>
              <h4 className="text-sm font-semibold text-[var(--text)] mb-3">{STRINGS.myApplications.applicationStatus}</h4>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div className="flex items-center justify-between p-3 rounded-lg bg-[var(--surface1)] border border-[var(--border)]">
                  <span className="text-sm text-[var(--textSecondary)]">{STRINGS.myApplications.status}</span>
                  {getStatusBadge(selectedApp.status)}
                </div>
                {selectedApp.confirmationStatus && (
                  <div className="flex items-center justify-between p-3 rounded-lg bg-[var(--surface1)] border border-[var(--border)]">
                    <span className="text-sm text-[var(--textSecondary)]">{STRINGS.myApplications.confirmation}</span>
                    <span className="text-sm font-medium text-[var(--text)]">{selectedApp.confirmationStatus}</span>
                  </div>
                )}
                {selectedApp.acknowledgedStatus && (
                  <div className="flex items-center justify-between p-3 rounded-lg bg-[var(--surface1)] border border-[var(--border)]">
                    <span className="text-sm text-[var(--textSecondary)]">{STRINGS.myApplications.acknowledged}</span>
                    <span className="text-sm font-medium text-[var(--text)]">{selectedApp.acknowledgedStatus}</span>
                  </div>
                )}
                {selectedApp.reconfirmationStatus && (
                  <div className="flex items-center justify-between p-3 rounded-lg bg-[var(--surface1)] border border-[var(--border)]">
                    <span className="text-sm text-[var(--textSecondary)]">{STRINGS.myApplications.reconfirmation}</span>
                    <span className="text-sm font-medium text-[var(--text)]">{selectedApp.reconfirmationStatus}</span>
                  </div>
                )}
                {selectedApp.writtenTestStatus && (
                  <div className="flex items-center justify-between p-3 rounded-lg bg-[var(--surface1)] border border-[var(--border)]">
                    <span className="text-sm text-[var(--textSecondary)]">{STRINGS.myApplications.writtenTest}</span>
                    <span className="text-sm font-medium text-[var(--text)]">{selectedApp.writtenTestStatus}</span>
                  </div>
                )}
                {selectedApp.interview && (
                  <div className="flex items-center justify-between p-3 rounded-lg bg-[var(--surface1)] border border-[var(--border)]">
                    <span className="text-sm text-[var(--textSecondary)]">{STRINGS.myApplications.interview}</span>
                    <span className="text-sm font-medium text-[var(--text)]">{selectedApp.interview}</span>
                  </div>
                )}
              </div>
            </div>

            {/* Resume */}
            {selectedApp.resumeFileName && (
              <div className="flex items-center gap-3 p-3 rounded-lg bg-[var(--surface1)] border border-[var(--border)]">
                <FileText size={20} className="text-[var(--primary)] flex-shrink-0" />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-[var(--text)]">{STRINGS.myApplications.resumeHeading}</p>
                  <p className="text-xs text-[var(--textSecondary)] truncate">{selectedApp.resumeFileName}</p>
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  isLoading={resumeViewer.loading}
                  leftIcon={<ExternalLink size={15} />}
                  onClick={() =>
                    resumeViewer.open(
                      selectedApp.email || selectedApp.userEmail,
                      selectedApp.resumeFileName,
                      selectedApp.jobPrefix,
                    )
                  }
                >
                  {STRINGS.myApplications.view}
                </Button>
              </div>
            )}

            {/* Deadline */}
            {selectedApp.applicationDeadline && (
              <div className="flex items-center gap-2 p-3 rounded-lg bg-[var(--surface1)] border border-[var(--border)]">
                <Calendar size={16} className="text-[var(--primary)] flex-shrink-0" />
                <span className="text-sm text-[var(--text)]">
                  {STRINGS.myApplications.applicationDeadline(formatDate(selectedApp.applicationDeadline))}
                </span>
              </div>
            )}
          </div>
        </Modal>
      )}

      {/* The resume sent with the application. Last in the page on purpose: this modal and the details modal share
          one stacking level, so the later of the two is the one on top. Placed before the details it opened
          behind them, where the candidate could not see it. */}
      {resumeViewer.resume && (
        <ResumeViewerModal resume={resumeViewer.resume} onClose={resumeViewer.close} />
      )}
    </div>
  );
}
