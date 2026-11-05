import { STRINGS } from '@/constants/strings';
import { useState } from 'react';
import { QRCodeSVG } from 'qrcode.react';
import {
  Monitor,
  CheckCircle2,
  Volume2,
  VolumeX,
  Timer,
  Shield,
  AlertTriangle,
  CheckCircle,
  XCircle,
  Loader2,
  Circle,
  Smartphone,
  ScanLine,
  Camera,
  Lock,
  Maximize,
  Copy,
  Check,
  Link2,
} from 'lucide-react';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { DeviceCheckPreview } from '@/components/testmode/DeviceCheckPreview';
import { buildProctoringRules } from '@/components/interview/interview-rules';
import { PROCTORING_CONFIG } from '@/config/proctoring.config';

/** Status icon for a device/permission check (granted / denied / checking / pending). */
function PermissionIcon({ status }: Readonly<{ status: string }>) {
  if (status === 'granted') return <CheckCircle size={16} className="text-emerald-500" />;
  if (status === 'denied') return <XCircle size={16} className="text-red-500" />;
  if (status === 'checking') return <Loader2 size={16} className="animate-spin text-gray-400" />;
  return <Circle size={16} className="text-amber-500" />;
}

/** One line in the "Rules and Guidelines" list, laid out as the exam lays it out. */
function RuleRow({ icon, text }: Readonly<{ icon: React.ReactNode; text: string }>) {
  return (
    <li className="flex items-start gap-3">
      <span className="mt-0.5 flex-shrink-0 text-[var(--primary)]">{icon}</span>
      <span className="text-sm sm:text-base text-[var(--text)]">{text}</span>
    </li>
  );
}

/** What the capture step is called, given which captures are switched on. */
function captureStepTitle(photoRequired: boolean, roomScanRequired: boolean): string {
  if (photoRequired && roomScanRequired) return STRINGS.preStart.captureTitlePhotoAndScan;
  return photoRequired ? STRINGS.preStart.captureTitlePhoto : STRINGS.preStart.captureTitleScan;
}

/** The QR link, shown as text for a phone whose camera will not scan it. */
function ManualPairingLink({ url }: Readonly<{ url: string }>) {
  const [copied, setCopied] = useState(false);

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
    } catch {
      // Clipboard blocked (insecure origin, or permission denied). The address
      // is on screen and selectable, which is the point of showing it — the
      // button is the convenience, not the mechanism.
      setCopied(false);
    }
  };

  return (
    <div className="space-y-2 rounded-lg border border-[var(--border)] bg-[var(--surface2)] p-3 sm:p-4">
      <p className="flex items-center gap-2 text-sm font-semibold text-[var(--text)]">
        <Link2 size={15} className="flex-shrink-0" />
        Cannot scan? Type this address into your phone&rsquo;s browser
      </p>
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
        <code className="min-w-0 flex-1 select-all break-all rounded-md border border-[var(--border)] bg-[var(--surface1)] px-3 py-2 font-mono text-xs text-[var(--text)]">
          {url}
        </code>
        <Button
          type="button"
          size="sm"
          variant="outline"
          onClick={copy}
          leftIcon={copied ? <Check size={14} /> : <Copy size={14} />}
          className="flex-shrink-0 sm:w-auto"
        >
          {copied ? STRINGS.preStart.copied : STRINGS.preStart.copy}
        </Button>
      </div>
      <p className="text-xs text-[var(--textTertiary)]">
        Open your phone&rsquo;s browser, type the address exactly as shown, and allow camera access
        when it asks. It opens the same page the QR code points to.
      </p>
    </div>
  );
}

interface InterviewPreStartScreenProps {
  jobPrefix: string;
  isSetupActive: boolean;
  mobileConnected: boolean;
  mobileVerified: boolean;
  /** QR value: the mobile-connect URL with token. */
  mobileConnectUrl: string;
  isSpeaking: boolean;
  onToggleAudio: () => void;
  isCountdownActive: boolean;
  instructionCountdown: number;
  micPermission: string;
  cameraPermission: string;
  error?: string;
  starting: boolean;
  canStartInterview: boolean;
  onStart: () => void;
  /** The interview these captures belong to. */
  scheduleId: number;
  candidateEmail: string;
  /** True once the identity photo and room sweep are both done. */
  capturesReady: boolean;
  /** When true the phone must be paired before the interview can begin. */
  mobileRequired: boolean;
  /** The candidate has declared they are going ahead without a phone. */
  mobileSkipped: boolean;
  onMobileSkippedChange: (skipped: boolean) => void;
  onCapturesReadyChange: (ready: boolean) => void;
}

/**
 * Everything a candidate does before the interview starts: read the rules,
 * check their devices, prove who they are and what room they are in, and put a
 * phone in place as a second camera.
 *
 * Laid out as the exam instructions screen is laid out — the same cards, the
 * same config-driven rule list, the same agreement checkbox and the same list
 * of what is still blocking the start. The two screens ask a candidate for the
 * same things on the same day and should not feel like different products.
 */
export function InterviewPreStartScreen({
  jobPrefix,
  isSetupActive,
  mobileConnected,
  mobileVerified,
  mobileConnectUrl,
  isSpeaking,
  onToggleAudio,
  isCountdownActive,
  instructionCountdown,
  micPermission,
  cameraPermission,
  error,
  starting,
  canStartInterview,
  onStart,
  scheduleId,
  candidateEmail,
  capturesReady,
  mobileRequired,
  mobileSkipped,
  onMobileSkippedChange,
  onCapturesReadyChange,
}: Readonly<InterviewPreStartScreenProps>) {
  /**
   * Proctoring switches, read from the same VITE_PROCTORING_* values the
   * assessment reads.
   *
   * The interview used to require the camera and both captures outright while
   * the exam honoured the environment, so the two flows disagreed about the
   * same candidate on the same machine. One source of truth means an
   * administrator changing a switch changes both.
   */
  const cameraRequired = PROCTORING_CONFIG.camera.required;
  const photoRequired = PROCTORING_CONFIG.identityPhoto.required;
  const roomScanRequired = PROCTORING_CONFIG.roomScan.required;
  const capturesNeeded = photoRequired || roomScanRequired;

  const [agreed, setAgreed] = useState(false);
  /**
   * The candidate's answer to "will you use a phone?". Null until they say: the QR is not the first
   * thing on the page, because a code shown before the question invites a scan the candidate may not
   * mean to make. Where the phone is required there is nothing to ask, so the code is shown at once.
   */
  const [wantsPhone, setWantsPhone] = useState(false);
  const showQr = mobileRequired || (wantsPhone && !mobileSkipped);
  const [enablingDevices, setEnablingDevices] = useState(false);

  /**
   * Raise the browser's permission prompt, then let the stream go.
   *
   * Only needed where the photo and room scan are both switched off: the check
   * component asks for the devices as a side effect of using them, and where it
   * is not on the page nothing else would ask until the interview had already
   * started — which is a poor moment to discover the microphone is blocked. The
   * grant outlives the stream, and InterviewPage's permission listeners update
   * the rows above.
   */
  const requestDevices = async () => {
    setEnablingDevices(true);
    try {
      const probe = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
      probe.getTracks().forEach((track) => track.stop());
    } catch {
      // Denied or unavailable — the permission rows say so, and the blockers
      // list says what to do about it.
    } finally {
      setEnablingDevices(false);
    }
  };

  /**
   * Whether the capture step is worth rendering at all.
   *
   * "Not denied", not "granted": the check component is what calls
   * getUserMedia, so it is what raises the browser's permission prompt. Waiting
   * for `granted` before rendering it meant waiting for a prompt that nothing
   * would ever raise — a candidate who had not previously allowed the camera on
   * this origin sat looking at "allow camera and microphone access first" with
   * nothing on the page able to ask for it, and a Start button held shut behind
   * a photo they could not take.
   */
  const devicesReady = micPermission !== 'denied' && cameraPermission !== 'denied';
  const rulesRead = !isCountdownActive;
  /** The phone question is settled: paired, or explicitly waived. */
  const mobileSettled = mobileVerified || (!mobileRequired && mobileSkipped);

  /**
   * Everything still standing between the candidate and the start button.
   *
   * Listed rather than left to a disabled button, exactly as the exam lists it:
   * a candidate who cannot start and is not told why assumes the page is broken
   * and reloads it, which is the one thing the rules tell them not to do.
   */
  const blockers: string[] = [];
  if (micPermission === 'denied') {
    blockers.push(STRINGS.preStart.blockers.micBlocked);
  }
  if (cameraRequired && cameraPermission === 'denied') {
    blockers.push(STRINGS.preStart.blockers.cameraBlocked);
  }
  if (!rulesRead) {
    blockers.push(STRINGS.preStart.blockers.countdown);
  }
  if (capturesNeeded && !capturesReady) {
    // Only a gate while at least one capture is switched on. Waiting on a step
    // that is configured off would leave Start permanently disabled.
    if (photoRequired && roomScanRequired) {
      blockers.push(STRINGS.preStart.blockers.photoAndScan);
    } else if (photoRequired) {
      blockers.push(STRINGS.preStart.blockers.photoOnly);
    } else {
      blockers.push(STRINGS.preStart.blockers.scanOnly);
    }
  }
  if (isSetupActive && !mobileSettled) {
    blockers.push(
      mobileRequired
        ? STRINGS.preStart.blockers.pairRequired
        : STRINGS.preStart.blockers.pairChoice,
    );
  }
  if (mobileVerified && !canStartInterview) {
    blockers.push(STRINGS.preStart.blockers.phoneChecking);
  }
  if (!agreed) {
    blockers.push(STRINGS.preStart.blockers.agree);
  }

  const canStart = blockers.length === 0;

  return (
    <div className="min-h-screen bg-[var(--background)]">
      <div className="mx-auto w-full max-w-3xl space-y-5 px-4 py-6 sm:px-6 sm:py-10">
        {/* Header */}
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div className="min-w-0">
            <h1 className="text-2xl font-bold text-[var(--text)] sm:text-3xl">
              {STRINGS.preStart.title}
            </h1>
            <p className="mt-1 text-[var(--textSecondary)]">
              {STRINGS.preStart.subtitle(jobPrefix)}
            </p>
          </div>

          {/* Audio narration */}
          <div className="flex flex-shrink-0 items-center gap-2">
            {isSpeaking && (
              <span className="flex items-center gap-1.5 rounded-full border border-blue-200 bg-blue-50 px-2.5 py-1.5 dark:border-blue-800 dark:bg-blue-900/20">
                <Volume2 size={13} className="animate-pulse text-blue-500" />
                <span className="text-xs font-medium text-blue-700 dark:text-blue-300">
                  {STRINGS.preStart.reading}
                </span>
              </span>
            )}
            <button
              type="button"
              onClick={onToggleAudio}
              className="flex items-center gap-1.5 rounded-full bg-blue-50 px-3 py-1.5 text-xs font-medium text-blue-600 transition-colors hover:bg-blue-100 dark:bg-blue-900/20 dark:text-blue-400 dark:hover:bg-blue-900/30"
              title={isSpeaking ? STRINGS.preStart.stopAudioHint : STRINGS.preStart.playAudioHint}
            >
              {isSpeaking ? <VolumeX size={14} /> : <Volume2 size={14} />}
              {isSpeaking ? STRINGS.preStart.stopAudio : STRINGS.preStart.playAudio}
            </button>
          </div>
        </div>

        {/* ── Rules ─────────────────────────────────────────────────── */}
        <Card>
          <CardHeader>
            <CardTitle>
              <div className="flex flex-wrap items-center justify-between gap-3">
                <span className="flex items-center gap-2">
                  <Shield className="h-5 w-5 text-[var(--primary)]" />
                  {STRINGS.preStart.rulesTitle}
                </span>
                {isCountdownActive && (
                  <span className="flex items-center gap-2 rounded-xl border border-[var(--border)] bg-[var(--surface2)] px-3 py-1.5">
                    <Timer size={16} className="text-[var(--primary)]" />
                    <span className="font-mono text-base font-bold tabular-nums text-[var(--text)]">
                      {String(Math.floor(instructionCountdown / 60)).padStart(2, '0')}:
                      {String(instructionCountdown % 60).padStart(2, '0')}
                    </span>
                  </span>
                )}
              </div>
            </CardTitle>
            {isCountdownActive && (
              <p className="mt-2 text-sm text-[var(--textSecondary)]">
                {STRINGS.preStart.rulesCountdown}
              </p>
            )}
          </CardHeader>
          <CardContent>
            <ul className="space-y-3">
              {buildProctoringRules().map((rule) => (
                <RuleRow key={rule.text} icon={rule.icon} text={rule.text} />
              ))}
            </ul>
          </CardContent>
        </Card>

        {/* ── System check ──────────────────────────────────────────── */}
        <Card>
          <CardHeader>
            <CardTitle>
              <div className="flex items-center gap-2">
                <Camera className="h-5 w-5 text-[var(--primary)]" />
                {STRINGS.preStart.systemCheck}
              </div>
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <div className="flex items-center gap-3 rounded-lg bg-[var(--surface2)] p-3">
                <PermissionIcon status={micPermission} />
                <span className="text-sm text-[var(--text)]">{STRINGS.preStart.microphone}</span>
                {micPermission === 'denied' && (
                  <span className="ml-auto text-right text-xs text-red-500">
                    {STRINGS.preStart.enableInSettings}
                  </span>
                )}
              </div>
              <div className="flex items-center gap-3 rounded-lg bg-[var(--surface2)] p-3">
                <PermissionIcon status={cameraPermission} />
                <span className="text-sm text-[var(--text)]">{STRINGS.preStart.camera}</span>
                {cameraPermission === 'denied' && (
                  <span className="ml-auto text-right text-xs text-red-500">
                    {cameraRequired ? STRINGS.preStart.enableInSettings : STRINGS.preStart.cameraOptional}
                  </span>
                )}
              </div>
              {PROCTORING_CONFIG.recording.screen.required && (
                <div className="flex items-center gap-3 rounded-lg bg-[var(--surface2)] p-3 sm:col-span-2">
                  <Monitor size={16} className="flex-shrink-0 text-[var(--primary)]" />
                  <span className="text-sm text-[var(--text)]">
                    {STRINGS.preStart.screenShareRequested}
                  </span>
                </div>
              )}
              {PROCTORING_CONFIG.fullscreen.enabled && (
                <div className="flex items-center gap-3 rounded-lg bg-[var(--surface2)] p-3 sm:col-span-2">
                  <Maximize size={16} className="flex-shrink-0 text-[var(--primary)]" />
                  <span className="text-sm text-[var(--text)]">
                    {STRINGS.preStart.fullscreenActivated}
                  </span>
                </div>
              )}
            </div>

            {/* Without the capture step below there is nothing on this screen
                that opens the devices, so the prompt has to be offered. */}
            {!capturesNeeded &&
              (micPermission !== 'granted' || cameraPermission !== 'granted') && (
                <Button
                  variant="outline"
                  onClick={requestDevices}
                  isLoading={enablingDevices}
                  disabled={micPermission === 'denied' && cameraPermission === 'denied'}
                  leftIcon={<Camera size={18} />}
                  className="w-full"
                >
                  {STRINGS.preStart.enableDevices}
                </Button>
              )}

            {/* Identity photo and room scan, when either is switched on. */}
            {capturesNeeded && (
              <div className="space-y-3 border-t border-[var(--border)] pt-6">
                <div>
                  <h3 className="font-semibold text-[var(--text)]">
                    {captureStepTitle(photoRequired, roomScanRequired)}
                  </h3>
                  <p className="mt-1 text-sm text-[var(--textSecondary)]">
                    {STRINGS.preStart.captureWhy}
                  </p>
                </div>

                <div className="flex items-start gap-2 rounded-lg bg-[var(--surface2)] p-3 text-sm text-[var(--textSecondary)]">
                  <ScanLine size={16} className="mt-0.5 flex-shrink-0 text-[var(--textTertiary)]" />
                  <p>
                    {STRINGS.preStart.captureHow}
                  </p>
                </div>

                {devicesReady ? (
                  <DeviceCheckPreview
                    // `persist` marks this as the real check rather than a
                    // rehearsal: the captures become stored evidence, and the
                    // VITE_PROCTORING_* switches decide which are asked for.
                    persist
                    target={{ kind: 'interview', scheduleId }}
                    candidateEmail={candidateEmail}
                    onReadyChange={onCapturesReadyChange}
                  />
                ) : (
                  <p className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-700 dark:border-amber-800 dark:bg-amber-900/20 dark:text-amber-300">
                    {STRINGS.preStart.allowDevicesFirst}
                  </p>
                )}
              </div>
            )}
          </CardContent>
        </Card>

        {/* ── The phone ─────────────────────────────────────────────── */}
        {isSetupActive && (
          <Card>
            <CardHeader>
              <CardTitle>
                <div className="flex items-center gap-2">
                  <Smartphone className="h-5 w-5 text-[var(--primary)]" />
                  {STRINGS.preStart.phone.title}
                  {mobileVerified && (
                    <span className="ml-1 flex items-center gap-1 rounded-full bg-emerald-100 px-2 py-0.5 text-xs font-semibold text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300">
                      <CheckCircle2 size={12} /> {STRINGS.preStart.phone.verifiedBadge}
                    </span>
                  )}
                </div>
              </CardTitle>
              <p className="mt-1 text-sm text-[var(--textSecondary)]">
                {mobileRequired
                  ? STRINGS.preStart.phone.purposeRequired
                  : STRINGS.preStart.phone.purposeOptional}
              </p>
            </CardHeader>
            <CardContent>
              {/* The choice comes first. Skipping closes pairing, so a phone cannot be scanned in
                  afterwards; choosing to pair is what brings up the code. */}
              {!mobileRequired && !mobileVerified && !mobileConnected && (
                <div className="space-y-3">
                  <label className="flex cursor-pointer items-start gap-3 rounded-lg border border-[var(--border)] bg-[var(--surface2)] p-3">
                    <input
                      type="checkbox"
                      checked={mobileSkipped}
                      onChange={(e) => {
                        if (e.target.checked) setWantsPhone(false);
                        onMobileSkippedChange(e.target.checked);
                      }}
                      className="mt-0.5 h-4 w-4 flex-shrink-0 rounded border-[var(--border)] text-[var(--primary)] focus:ring-[var(--primary)]"
                    />
                    <span className="text-sm text-[var(--text)]">
                      {STRINGS.preStart.phone.continueWithout}
                      <span className="mt-0.5 block text-xs text-[var(--textSecondary)]">
                        {STRINGS.preStart.phone.continueWithoutNote}
                      </span>
                    </span>
                  </label>
                  {!mobileSkipped && !wantsPhone && (
                    <Button variant="outline" onClick={() => setWantsPhone(true)} leftIcon={<ScanLine size={16} />}>
                      {STRINGS.preStart.phone.usePhone}
                    </Button>
                  )}
                </div>
              )}

              {showQr && !mobileConnected && (
                <div className="space-y-4">
                  <div className="flex flex-col items-center gap-4 sm:flex-row sm:items-start">
                    <div className="flex-shrink-0 rounded-xl bg-white p-3 shadow-inner">
                      <QRCodeSVG value={mobileConnectUrl} size={160} />
                    </div>
                    <div className="min-w-0 flex-1 space-y-2">
                      <p className="text-sm font-semibold text-[var(--text)]">
                        {STRINGS.preStart.phone.scanThis}
                      </p>
                      <ul className="space-y-1.5 text-sm text-[var(--textSecondary)]">
                        <li>{STRINGS.preStart.phone.tipPlacement}</li>
                        <li>
                          {STRINGS.preStart.phone.tipAngleBefore}
                          <strong className="text-[var(--text)]">{STRINGS.preStart.phone.tipAngleBold}</strong>
                          {STRINGS.preStart.phone.tipAngleAfter}
                        </li>
                        <li>{STRINGS.preStart.phone.tipPower}</li>
                        <li>{STRINGS.preStart.phone.tipTab}</li>
                      </ul>
                    </div>
                  </div>

                  {/* The same link as text. A phone whose camera will not focus
                      on a QR code, or whose scanner is disabled by policy, had
                      no way in at all — the code was the only route offered. */}
                  <ManualPairingLink url={mobileConnectUrl} />

                  <p className="flex items-start gap-2 text-xs text-[var(--textTertiary)]">
                    <Lock size={12} className="mt-0.5 flex-shrink-0" />
                    {STRINGS.preStart.phone.proctoringOnly}
                  </p>
                </div>
              )}

              {mobileConnected && !mobileVerified && (
                <div className="space-y-3 py-2">
                  <div className="flex items-center justify-center gap-2">
                    <Monitor className="h-4 w-4 text-blue-600 dark:text-blue-400" />
                    <p className="text-sm font-medium text-blue-600 dark:text-blue-400">
                      {STRINGS.preStart.phone.connected}
                    </p>
                  </div>
                  <p className="text-center text-xs text-[var(--textSecondary)]">
                    {STRINGS.preStart.phone.finishRoomCheck}
                  </p>
                </div>
              )}

              {mobileVerified && (
                <div className="space-y-3 py-2">
                  <div className="flex items-center justify-center gap-2">
                    <CheckCircle2 className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
                    <p className="text-sm font-medium text-emerald-600 dark:text-emerald-400">
                      {STRINGS.preStart.phone.verified}
                    </p>
                  </div>
                  <p className="text-center text-xs text-[var(--textSecondary)]">
                    {STRINGS.preStart.phone.leaveInPlace}
                  </p>
                </div>
              )}

              {/* Skipped is a status, like verified: said plainly, with no picture. */}
              {mobileSkipped && !mobileVerified && !mobileRequired && (
                <div className="flex items-center justify-center gap-2 py-2">
                  <AlertTriangle className="h-4 w-4 text-amber-600 dark:text-amber-400" />
                  <p className="text-sm font-medium text-amber-600 dark:text-amber-400">{STRINGS.preStart.phone.skipped}</p>
                </div>
              )}

              {mobileRequired && !mobileVerified && (
                <p className="mt-4 flex items-start gap-2 rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-700 dark:border-amber-800 dark:bg-amber-900/20 dark:text-amber-300">
                  <AlertTriangle size={15} className="mt-0.5 flex-shrink-0" />
                  {STRINGS.preStart.phone.cannotStart}
                </p>
              )}
            </CardContent>
          </Card>
        )}

        {/* ── Agreement and start ───────────────────────────────────── */}
        <Card>
          <CardContent>
            <div className="space-y-4">
              <label className="flex cursor-pointer items-start gap-3">
                <input
                  type="checkbox"
                  checked={agreed}
                  onChange={(e) => setAgreed(e.target.checked)}
                  className="mt-1 h-4 w-4 flex-shrink-0 rounded border-[var(--border)] text-[var(--primary)] focus:ring-[var(--primary)]"
                />
                <span className="text-sm text-[var(--text)]">
                  {STRINGS.preStart.agreement}
                </span>
              </label>

              {error && (
                <div className="flex items-start gap-2 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-600 dark:border-red-800 dark:bg-red-900/20 dark:text-red-400">
                  <AlertTriangle className="mt-0.5 h-4 w-4 flex-shrink-0" />
                  <span className="min-w-0 break-words">{error}</span>
                </div>
              )}

              {blockers.length > 0 && (
                <ul
                  role="alert"
                  className="space-y-1.5 rounded-lg border border-amber-300 bg-amber-50 p-3 dark:border-amber-700/60 dark:bg-amber-900/20"
                >
                  <li className="text-sm font-semibold text-[var(--text)]">{STRINGS.preStart.beforeYouBegin}</li>
                  {blockers.map((blocker) => (
                    <li
                      key={blocker}
                      className="flex items-start gap-2 text-sm text-[var(--textSecondary)]"
                    >
                      <AlertTriangle
                        size={15}
                        className="mt-0.5 flex-shrink-0 text-[var(--warning)]"
                      />
                      {blocker}
                    </li>
                  ))}
                </ul>
              )}

              <Button
                size="lg"
                className="w-full"
                onClick={onStart}
                isLoading={starting}
                disabled={!canStart}
              >
                {mobileSkipped && !mobileVerified ? STRINGS.preStart.beginWithoutPhone : STRINGS.preStart.begin}
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
