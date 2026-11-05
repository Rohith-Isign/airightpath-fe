import { STRINGS } from '@/constants/strings';
import {
  Video,
  Monitor,
  Shield,
  ScanLine,
  Mic,
  Camera,
  Clock,
  Users,
  Maximize,
  RotateCcw,
  Wifi,
  BatteryCharging,
  BellOff,
} from 'lucide-react';
import { PROCTORING_CONFIG } from '@/config/proctoring.config';

/** One rule as the instructions and the interview screen both render it. */
export interface ProctoringRule {
  icon: React.ReactNode;
  text: string;
}

/**
 * The proctoring rules, built from the same switches the proctoring actually
 * reads.
 *
 * Exported because the interview screen shows the same list once the interview
 * is running — a candidate mid-interview who cannot remember whether leaving
 * fullscreen costs them a warning should not have to guess, and a second
 * hand-written copy of this list would start disagreeing with the first the
 * moment a switch moved.
 */
export function buildProctoringRules(): ProctoringRule[] {
  const rules: ProctoringRule[] = [];
  const p = PROCTORING_CONFIG;

  rules.push({
    icon: <Monitor size={18} />,
    text: STRINGS.rules.device,
  });
  rules.push({
    icon: <Clock size={18} />,
    text: STRINGS.rules.duration,
  });
  rules.push({
    icon: <Mic size={18} />,
    text: STRINGS.rules.speak,
  });

  if (p.camera.required) {
    rules.push({
      icon: <Camera size={18} />,
      text: STRINGS.rules.cameraOn,
    });
  }
  if (p.identityPhoto.required) {
    rules.push({
      icon: <Camera size={18} />,
      text: STRINGS.rules.photo,
    });
  }
  if (p.roomScan.required) {
    rules.push({
      icon: <ScanLine size={18} />,
      text: STRINGS.rules.roomScan,
    });
  }
  if (p.recording.camera.required) {
    rules.push({
      icon: <Video size={18} />,
      text: STRINGS.rules.cameraRecorded,
    });
  }
  if (p.recording.screen.required) {
    rules.push({
      icon: <Monitor size={18} />,
      text: STRINGS.rules.screenRecorded,
    });
  }
  if (p.eyeDetection.enabled) {
    rules.push({
      icon: <Users size={18} />,
      text: STRINGS.rules.alone,
    });
  }
  if (p.fullscreen.enabled) {
    rules.push({
      icon: <Maximize size={18} />,
      text: STRINGS.rules.fullscreen,
    });
  }
  if (p.tabSwitch.enabled) {
    rules.push({
      icon: <Monitor size={18} />,
      text: STRINGS.rules.tabs,
    });
  }

  rules.push({
    icon: <Shield size={18} />,
    // Was "999999 warnings end the interview automatically", which was false
    // twice over: the number was a disabled threshold, and the server was
    // ending interviews at five of its own. Nothing ends an interview on a
    // warning count now — they are recorded, and a person reads them.
    text: STRINGS.rules.warnings,
  });
  rules.push({
    icon: <RotateCcw size={18} />,
    // Still discouraged — leaving is a proctoring event, the clock keeps
    // running and the camera checks stop — but no longer fatal, so the rule no
    // longer says it is. Telling a candidate their interview is unrecoverable
    // when it is not turns a recoverable blip into a panic.
    text: STRINGS.rules.noReload,
  });
  rules.push({
    icon: <Wifi size={18} />,
    text: STRINGS.rules.connection,
  });
  rules.push({
    icon: <BatteryCharging size={18} />,
    text: STRINGS.rules.power,
  });
  rules.push({
    icon: <BellOff size={18} />,
    text: STRINGS.rules.distractions,
  });

  return rules;
}
