import { useEffect, useRef, useState } from 'react';
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

/**
 * A Word document drawn the way Word draws it: page, margins, fonts, shaded section bars, centred headings and
 * bullet glyphs all kept.
 *
 * Rendered by `docx-preview`, which lays the document out from its own styles. The earlier converter kept only the
 * text structure (headings and lists), so a resume that is carefully formatted in Word came out as a plain list.
 */
function DocxPreview({ resume }: Readonly<{ resume: ResumeView }>) {
  const hostRef = useRef<HTMLDivElement>(null);
  const [status, setStatus] = useState<'loading' | 'ready' | 'failed'>('loading');

  useEffect(() => {
    let cancelled = false;
    setStatus('loading');
    (async () => {
      try {
        // Loaded on demand: the renderer is large and only Word resumes need it.
        const { renderAsync } = await import('docx-preview');
        const buffer = await (await fetch(resume.url)).arrayBuffer();
        const host = hostRef.current;
        if (cancelled || !host) return;
        host.innerHTML = '';
        await renderAsync(buffer, host, undefined, {
          className: 'docx',
          inWrapper: true,
          // Images are inlined, so nothing the document points at is fetched by this page.
          useBase64URL: true,
          breakPages: true,
          renderHeaders: true,
          renderFooters: true,
          renderFootnotes: true,
        });
        if (cancelled) return;
        // The document is the candidate's, not ours: only ordinary links are left clickable, and they open
        // elsewhere. Scripts are never run by the renderer; this closes the one remaining route, a link.
        host.querySelectorAll('a').forEach((link) => {
          const href = link.getAttribute('href') ?? '';
          if (/^(https?:|mailto:)/i.test(href)) {
            link.setAttribute('target', '_blank');
            link.setAttribute('rel', 'noopener noreferrer');
          } else {
            link.removeAttribute('href');
          }
        });
        setStatus(host.textContent?.trim() ? 'ready' : 'failed');
      } catch {
        if (!cancelled) setStatus('failed');
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [resume.url]);

  return (
    <div className="relative">
      {status === 'failed' && (
        <NoPreview resume={resume} message="This Word document could not be previewed here." />
      )}
      {status === 'loading' && (
        <div className="absolute inset-0 z-10 flex items-center justify-center bg-white/70">
          <Loader2 className="h-6 w-6 animate-spin text-[var(--primary)]" />
        </div>
      )}
      {/* Always mounted: the renderer needs the element to draw into. Grey surround, white pages, as in Word. */}
      <div
        ref={hostRef}
        className={`h-[70vh] overflow-auto rounded-lg border border-[var(--border)] bg-[#e5e7eb] ${
          status === 'failed' ? 'hidden' : ''
        }`}
      />
    </div>
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
