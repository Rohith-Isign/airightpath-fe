import { useEffect, useState } from 'react';
import { usePersistentState } from '@/hooks/usePersistentState';
import { Loader2, BarChart3, FileStack, Trash2 } from 'lucide-react';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Textarea } from '@/components/ui/Textarea';
import { Badge } from '@/components/ui/Badge';
import { FileUpload } from '@/components/ui/FileUpload';
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from '@/components/ui/Table';
import { EmptyState } from '@/components/ui/EmptyState';
import { useToast } from '@/components/ui/Toast';
import { atsService, type BatchScreenResult } from '@/services/ats.service';
import { MESSAGES } from '@/config/messages';
import { clearFiles, loadFiles, saveFiles } from '@/utils/file-store.utils';

const FILES_KEY = 'atsBatch:files';

export function AtsBatchPage() {
  const { showToast } = useToast();

  const [files, setFiles] = useState<File[]>([]);
  // Everything on this page survives a refresh: the job description and the ranked results (sessionStorage, for the
  // tab), and the chosen resumes themselves (IndexedDB, since a File cannot go in sessionStorage). "Clear all" empties
  // all of it.
  const [jobDescription, setJobDescription] = usePersistentState('atsBatch:jobDescription', '');
  const [results, setResults] = usePersistentState<BatchScreenResult[]>('atsBatch:results', []);
  const [loading, setLoading] = useState(false);
  // False until the kept files are read back, so the empty list on first render is not saved over them.
  const [restored, setRestored] = useState(false);

  useEffect(() => {
    let cancelled = false;
    loadFiles(FILES_KEY).then((kept) => {
      if (cancelled) return;
      setFiles(kept);
      setRestored(true);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (restored) void saveFiles(FILES_KEY, files);
  }, [files, restored]);

  function clearAll() {
    setFiles([]);
    setResults([]);
    setJobDescription('');
    void clearFiles(FILES_KEY);
  }

  /** The list changed: a resume taken out takes its result with it, a resume added leaves the others as they are. */
  function handleFilesChange(next: File[]) {
    setFiles(next);
    const names = new Set(next.map((f) => f.name));
    setResults((prev) => prev.filter((r) => !r.fileName || names.has(r.fileName)));
  }

  async function handleSubmit() {
    if (files.length === 0) {
      showToast(MESSAGES.admin.atsBatch.resumeRequired, 'warning');
      return;
    }
    if (!jobDescription.trim()) {
      showToast(MESSAGES.admin.atsBatch.jobDescriptionRequired, 'warning');
      return;
    }

    setLoading(true);
    setResults([]);
    try {
      const formData = new FormData();
      files.forEach((file) => formData.append('resumes', file));
      formData.append('jobDescription', jobDescription.trim());

      const res = await atsService.screenBatch(formData);

      const sorted = [...(res.data ?? [])].sort((a, b) => b.score - a.score);
      setResults(sorted);
      showToast(MESSAGES.admin.atsBatch.screened(sorted.length), 'success');
    } catch {
      // Error toast auto-handled by interceptor
    } finally {
      setLoading(false);
    }
  }

  function getScoreVariant(score: number): 'success' | 'warning' | 'error' {
    if (score >= 80) return 'success';
    if (score >= 60) return 'warning';
    return 'error';
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-[var(--text)]">Bulk ATS Check</h1>
        <p className="text-[var(--textSecondary)] mt-1">
          Upload a batch of resumes, paste any job description, and see who fits best — ranked in seconds
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Upload Section */}
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between gap-3">
              <div className="flex items-center gap-2">
                <FileStack size={20} className="text-[var(--primary)]" />
                <CardTitle>Upload Resumes{files.length > 0 ? ` (${files.length})` : ''}</CardTitle>
              </div>
              {(files.length > 0 || results.length > 0 || jobDescription) && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={clearAll}
                  disabled={loading}
                  leftIcon={<Trash2 size={14} />}
                >
                  Clear all
                </Button>
              )}
            </div>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <FileUpload
                label="Resume Files"
                accept=".pdf,.doc,.docx"
                multiple
                maxSizeBytes={2 * 1024 * 1024}
                value={files}
                onChange={handleFilesChange}
                onError={(msg) => showToast(msg, 'error')}
                helperText="Upload PDF, DOC, or DOCX files (max 2MB each)"
              />
            </div>
          </CardContent>
        </Card>

        {/* Job Description Section */}
        <Card>
          <CardHeader>
            <CardTitle>Job Description</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <Textarea
                placeholder="Paste the job description to match against..."
                value={jobDescription}
                onChange={(e) => setJobDescription(e.target.value)}
                maxLength={5000}
                showCharCount
                className="min-h-[200px]"
              />
              <Button
                onClick={handleSubmit}
                isLoading={loading}
                leftIcon={!loading ? <BarChart3 size={16} /> : undefined}
                className="w-full"
              >
                Screen All Resumes
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Results */}
      {loading && (
        <Card>
          <CardContent>
            <div className="flex flex-col items-center justify-center py-12">
              <Loader2 size={36} className="animate-spin text-[var(--primary)] mb-3" />
              <p className="text-sm text-[var(--textSecondary)]">
                Screening {files.length} resume{files.length !== 1 ? 's' : ''}...
              </p>
            </div>
          </CardContent>
        </Card>
      )}

      {!loading && results.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Ranked Results ({results.length})</CardTitle>
          </CardHeader>
          <CardContent>
            {/* Mobile: one card per result. Filenames and emails are long free
                text, so on a phone the table scrolled sideways and pushed the
                score — the reason to read this screen — out of view. */}
            <div className="md:hidden space-y-3">
              {results.map((r, idx) => (
                <div
                  key={r.fileName ?? idx}
                  className="rounded-2xl border border-[var(--borderMuted,var(--border))] bg-[var(--cardBg)] p-4"
                >
                  <div className="flex items-start gap-3">
                    <span className="flex-shrink-0 w-8 h-8 rounded-xl bg-[var(--bgSubtle,var(--surface1))] flex items-center justify-center text-xs font-bold text-[var(--text)]">
                      {idx + 1}
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="font-medium text-[var(--text)] break-words">
                        {r.candidateName || r.fileName || `Resume ${idx + 1}`}
                      </p>
                      <p className="text-sm text-[var(--textSecondary)] break-all">
                        {r.email || '--'}
                      </p>
                    </div>
                    <Badge variant={getScoreVariant(r.score)} size="md">
                      {r.score}%
                    </Badge>
                  </div>
                </div>
              ))}
            </div>

            {/* Desktop: fixed layout so the two free-text columns wrap instead
                of stretching the table past the card. */}
            <div className="hidden md:block">
              <Table className="table-fixed">
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-16">Rank</TableHead>
                    <TableHead className="w-[38%]">File / Candidate</TableHead>
                    <TableHead className="w-[38%]">Email</TableHead>
                    <TableHead className="w-24">Score</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {results.map((r, idx) => (
                    <TableRow key={r.fileName ?? idx}>
                      <TableCell className="align-top">
                        <span className="text-sm font-bold text-[var(--text)]">#{idx + 1}</span>
                      </TableCell>
                      <TableCell className="font-medium align-top break-words">
                        {r.candidateName || r.fileName || `Resume ${idx + 1}`}
                      </TableCell>
                      <TableCell className="align-top break-all">{r.email || '--'}</TableCell>
                      <TableCell className="align-top">
                        <Badge variant={getScoreVariant(r.score)} size="md">
                          {r.score}%
                        </Badge>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>
      )}

      {!loading && results.length === 0 && files.length === 0 && (
        <Card>
          <CardContent>
            <EmptyState
              icon={<FileStack size={48} />}
              title="No results yet"
              description="Upload resumes and a job description, then click 'Screen All Resumes' to see ranked results."
            />
          </CardContent>
        </Card>
      )}
    </div>
  );
}
