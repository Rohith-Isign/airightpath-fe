import { useEffect, useState } from 'react';
import { Download, ExternalLink, FileText, Loader2 } from 'lucide-react';
import { Modal } from '@/components/ui/Modal';
import { Button } from '@/components/ui/Button';
import { downloadResumeFile } from '@/hooks/useResumeViewer';
import type { ResumeView } from '@/hooks/useResumeViewer';

type ResumeKind = 'pdf' | 'docx' | 'other';

/**
 * What the file is, from its MIME type and, failing that, its name.
 *
 * The type alone is not enough: a response with no content type used to be treated as a PDF, so a Word file was put in
 * an iframe, which only makes the browser download it and leaves the frame blank.
 */
function kindOf(resume: ResumeView): ResumeKind {
  const type = (resume.type ?? '').toLowerCase();
  const name = resume.name.toLowerCase();
  if (type.includes('pdf') || name.endsWith('.pdf')) return 'pdf';
  if (type.includes('wordprocessingml') || name.endsWith('.docx')) return 'docx';
  return 'other';
}

/** A Word document turned into HTML in the browser, so it can be read here instead of downloaded. */
function DocxPreview({ resume }: Readonly<{ resume: ResumeView }>) {
  const [html, setHtml] = useState<string | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let cancelled = false;
    setHtml(null);
    setFailed(false);
    (async () => {
      try {
        // Loaded on demand: the converter is large and only Word resumes need it.
        const [mammoth, { default: DOMPurify }] = await Promise.all([
          import('mammoth'),
          import('dompurify'),
        ]);
        const buffer = await (await fetch(resume.url)).arrayBuffer();
        const result = await mammoth.convertToHtml({ arrayBuffer: buffer });
        if (!cancelled) setHtml(DOMPurify.sanitize(result.value));
      } catch {
        if (!cancelled) setFailed(true);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [resume.url]);

  if (failed) return <NoPreview resume={resume} message="This Word document could not be previewed here." />;
  if (html === null) {
    return (
      <div className="flex h-[40vh] items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-[var(--primary)]" />
      </div>
    );
  }
  if (!html.trim()) {
    return <NoPreview resume={resume} message="This Word document has no text to preview." />;
  }
  return (
    <div
      className="h-[70vh] overflow-auto rounded-lg border border-[var(--border)] bg-white p-6 text-sm leading-relaxed text-black [&_h1]:mb-2 [&_h1]:text-xl [&_h1]:font-bold [&_h2]:mb-2 [&_h2]:text-lg [&_h2]:font-semibold [&_li]:ml-5 [&_li]:list-disc [&_p]:mb-2 [&_table]:w-full [&_td]:border [&_td]:p-1"
      // The HTML is sanitised above; nothing in a resume may run script on this page.
      dangerouslySetInnerHTML={{ __html: html }}
    />
  );
}

function NoPreview({ resume, message }: Readonly<{ resume: ResumeView; message: string }>) {
  return (
    <div className="flex h-[40vh] flex-col items-center justify-center gap-3 rounded-lg border border-dashed border-[var(--border)] px-6 text-center">
      <FileText size={36} className="text-[var(--textSecondary)]" />
      <p className="text-sm text-[var(--textSecondary)]">{message} Download it to open in Word.</p>
      <Button size="sm" leftIcon={<Download size={15} />} onClick={() => downloadResumeFile(resume)}>
        Download resume
      </Button>
    </div>
  );
}

/**
 * Shows the resume `useResumeViewer` fetched, with the same three exits every
 * document viewer on this screen offers: close, open in a tab, download.
 *
 * A PDF is shown in the browser's own viewer, a Word (.docx) file is converted and shown as text, and anything else
 * says it cannot be previewed and offers the download.
 */
export function ResumeViewerModal({
  resume,
  onClose,
}: Readonly<{ resume: ResumeView; onClose: () => void }>) {
  const kind = kindOf(resume);

  return (
    <Modal
      isOpen
      onClose={onClose}
      title={resume.name}
      size="xl"
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            Close
          </Button>
          {/* A tab cannot show a Word file either: it would only download it. */}
          {kind === 'pdf' && (
            <Button
              variant="outline"
              leftIcon={<ExternalLink size={16} />}
              onClick={() => window.open(resume.url, '_blank', 'noopener,noreferrer')}
            >
              Open in New Tab
            </Button>
          )}
          <Button leftIcon={<Download size={16} />} onClick={() => downloadResumeFile(resume)}>
            Download
          </Button>
        </>
      }
    >
      {kind === 'pdf' && (
        <iframe
          src={resume.url}
          title="Resume"
          className="w-full h-[70vh] rounded-lg border border-[var(--border)] bg-white"
        />
      )}
      {kind === 'docx' && <DocxPreview resume={resume} />}
      {kind === 'other' && (
        <NoPreview resume={resume} message="This resume is in a format the browser can't preview." />
      )}
    </Modal>
  );
}
