'use client';

/* eslint-disable @next/next/no-img-element */
import { useEffect, useRef, useState } from 'react';
import { useStore } from '@/lib/store';
import { Camera, CheckCircle2, Loader2, ScanFace, ShieldCheck, Smartphone, Sun, Video, XCircle } from 'lucide-react';

type Stage = 'warn' | 'camera' | 'matching' | 'done' | 'error';

/** Warning shown before any camera use (course start and face recognition). */
export function CameraWarning({ compact = false }: { compact?: boolean }) {
  return (
    <div className="space-y-2.5">
      <div className="flex gap-3 rounded-xl border border-rust-100 bg-rust-50 p-3 text-sm text-rust-700">
        <Video size={18} className="mt-0.5 shrink-0" />
        <p>
          <b>You will be required to show video.</b> Your camera will be switched on and your face must stay visible{compact ? '.' : ' for identity verification. Recordings are kept for audit purposes.'}
        </p>
      </div>
      <div className="flex gap-3 rounded-xl border border-sand-300 bg-sand-50 p-3 text-sm text-sand-700">
        <Smartphone size={18} className="mt-0.5 shrink-0" />
        <p>
          <b>Please follow Shell mobile usage guidelines always during work.</b> Do not use your phone while driving, or in the dispenser and tanker offload areas.
        </p>
      </div>
      {!compact && (
        <div className="flex gap-3 rounded-xl bg-petrol-50 p-3 text-sm text-petrol-600">
          <Sun size={18} className="mt-0.5 shrink-0" />
          <p>Sit facing a light, remove sunglasses or caps, and keep only one person in view.</p>
        </div>
      )}
    </div>
  );
}

export function FaceVerify({
  context,
  onComplete,
  onCancel,
}: {
  context: string;
  onComplete: (passed: boolean, score: number) => void;
  onCancel?: () => void;
}) {
  const { currentUser, enrolFace, recordFaceCheck } = useStore();
  const [stage, setStage] = useState<Stage>('warn');
  const [agree, setAgree] = useState(false);
  const [stream, setStream] = useState<MediaStream | null>(null);
  const [shot, setShot] = useState<string | null>(null);
  const [score, setScore] = useState(0);
  const [faceSeen, setFaceSeen] = useState<boolean | null>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const enrolled = !!currentUser?.facePhoto;

  // Attach the stream once the <video> exists (it's only rendered in the camera stage).
  useEffect(() => {
    if (videoRef.current && stream && videoRef.current.srcObject !== stream) videoRef.current.srcObject = stream;
  });
  useEffect(() => () => stream?.getTracks().forEach((t) => t.stop()), [stream]);

  // Lightweight live check: use the browser FaceDetector when available,
  // otherwise check that the frame isn't blank.
  useEffect(() => {
    if (stage !== 'camera' || !stream) return;
    let alive = true;
    const Detector = (window as unknown as { FaceDetector?: new () => { detect: (v: HTMLVideoElement) => Promise<unknown[]> } }).FaceDetector;
    const det = Detector ? new Detector() : null;
    const tick = async () => {
      const v = videoRef.current;
      if (!alive || !v || v.readyState < 2) return;
      try {
        if (det) setFaceSeen((await det.detect(v)).length === 1);
        else {
          const c = document.createElement('canvas');
          c.width = 32;
          c.height = 24;
          const ctx = c.getContext('2d')!;
          ctx.drawImage(v, 0, 0, 32, 24);
          const d = ctx.getImageData(0, 0, 32, 24).data;
          let sum = 0, sq = 0;
          for (let i = 0; i < d.length; i += 4) {
            const l = (d[i] + d[i + 1] + d[i + 2]) / 3;
            sum += l;
            sq += l * l;
          }
          const n = d.length / 4, mean = sum / n;
          setFaceSeen(mean > 25 && Math.sqrt(sq / n - mean * mean) > 12);
        }
      } catch {
        setFaceSeen(true);
      }
    };
    const id = setInterval(tick, 600);
    return () => {
      alive = false;
      clearInterval(id);
    };
  }, [stage, stream]);

  async function openCamera() {
    try {
      const s = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'user', width: 640, height: 480 } });
      setStream(s);
      setStage('camera');
    } catch {
      setStage('error');
    }
  }

  function capture(simulated = false) {
    let data = '';
    const v = videoRef.current;
    if (!simulated && v && v.videoWidth) {
      const c = document.createElement('canvas');
      const size = Math.min(v.videoWidth, v.videoHeight);
      c.width = 320;
      c.height = 320;
      c.getContext('2d')!.drawImage(v, (v.videoWidth - size) / 2, (v.videoHeight - size) / 2, size, size, 0, 0, 320, 320);
      data = c.toDataURL('image/jpeg', 0.8);
    } else {
      const c = document.createElement('canvas');
      c.width = 320;
      c.height = 320;
      const g = c.getContext('2d')!;
      g.fillStyle = '#1D3D60';
      g.fillRect(0, 0, 320, 320);
      g.fillStyle = '#FBCE07';
      g.beginPath();
      g.arc(160, 130, 62, 0, Math.PI * 2);
      g.fill();
      g.beginPath();
      g.ellipse(160, 300, 110, 90, 0, 0, Math.PI * 2);
      g.fill();
      data = c.toDataURL('image/png');
    }
    stream?.getTracks().forEach((t) => t.stop());
    setStream(null);
    setShot(data);
    setStage('matching');
    const s = 94 + Math.random() * 5.4;
    setTimeout(() => {
      setScore(s);
      if (!enrolled) enrolFace(data);
      recordFaceCheck(context, s, true);
      setStage('done');
    }, 2200);
  }

  return (
    <div>
      {stage === 'warn' && (
        <div className="space-y-4">
          <CameraWarning />
          <label className="flex items-start gap-2 text-sm text-ink">
            <input type="checkbox" className="mt-1 accent-petrol-500" checked={agree} onChange={(e) => setAgree(e.target.checked)} />
            I understand and I am ready to turn on my camera.
          </label>
          <div className="flex gap-2">
            {onCancel && <button onClick={onCancel} className="btn-secondary">Cancel</button>}
            <button disabled={!agree} onClick={openCamera} className="btn-primary flex-1">
              <Camera size={16} /> Start camera
            </button>
          </div>
        </div>
      )}

      {stage === 'camera' && (
        <div className="space-y-3">
          <div className="relative overflow-hidden rounded-2xl bg-ink">
            <video ref={videoRef} autoPlay playsInline muted className="aspect-[4/3] w-full -scale-x-100 object-cover" />
            <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
              <div className={`relative h-[72%] w-[48%] rounded-[50%] border-4 ${faceSeen ? 'border-leaf-400' : 'border-white/70'} shadow-[0_0_0_9999px_rgba(15,35,56,.45)] transition-colors`}>
                <span className="absolute left-[8%] right-[8%] h-0.5 animate-scan bg-sand-400/90 shadow-[0_0_12px_#FBCE07]" />
              </div>
            </div>
            <p className={`absolute inset-x-0 bottom-3 mx-auto w-max rounded-full px-3 py-1 text-xs font-medium ${faceSeen ? 'bg-leaf-500 text-white' : 'bg-white/90 text-ink'}`}>
              {faceSeen === null ? 'Starting camera…' : faceSeen ? 'Face detected — hold still' : 'Position your face inside the oval'}
            </p>
          </div>
          <button onClick={() => capture()} className="btn-primary w-full py-2.5">
            <ScanFace size={17} /> Capture &amp; verify
          </button>
        </div>
      )}

      {stage === 'matching' && (
        <div className="flex flex-col items-center py-6 text-center">
          <div className="relative">
            {shot && <img src={shot} alt="" className="h-36 w-36 rounded-full object-cover ring-4 ring-petrol-100" />}
            <span className="absolute inset-0 rounded-full border-4 border-transparent border-t-sand-500 animate-spin" />
          </div>
          <p className="mt-5 flex items-center gap-2 font-medium text-ink"><Loader2 size={16} className="animate-spin" /> {enrolled ? 'Matching against your enrolled photo…' : 'Creating your face profile…'}</p>
          <p className="mt-1 text-xs text-slate-400">Liveness and face-match (simulated in the prototype; production uses Amazon Rekognition).</p>
        </div>
      )}

      {stage === 'done' && (
        <div className="space-y-4 text-center">
          <div className="flex items-center justify-center gap-4 pt-2">
            {currentUser?.facePhoto && enrolled && <img src={currentUser.facePhoto} alt="Enrolled" className="h-24 w-24 rounded-full object-cover ring-4 ring-petrol-100" />}
            {shot && <img src={shot} alt="Captured" className="h-24 w-24 rounded-full object-cover ring-4 ring-leaf-400" />}
          </div>
          <div className="rounded-xl bg-leaf-50 p-4">
            <p className="flex items-center justify-center gap-2 font-display text-lg font-semibold text-leaf-700"><CheckCircle2 size={20} /> Identity verified</p>
            <p className="mt-1 text-sm text-leaf-700">Match confidence <b className="app-number">{score.toFixed(1)}%</b> · liveness passed{!enrolled && ' · face profile enrolled'}</p>
          </div>
          <button onClick={() => onComplete(true, score)} className="btn-primary w-full">
            <ShieldCheck size={16} /> Continue
          </button>
        </div>
      )}

      {stage === 'error' && (
        <div className="space-y-4">
          <div className="flex gap-3 rounded-xl bg-rust-50 p-4 text-sm text-rust-700">
            <XCircle size={18} className="mt-0.5 shrink-0" />
            <p>We couldn&apos;t open your camera. Allow camera access in your browser settings and try again.</p>
          </div>
          <div className="flex gap-2">
            <button onClick={openCamera} className="btn-primary flex-1"><Camera size={16} /> Try again</button>
            <button onClick={() => capture(true)} className="btn-secondary flex-1" title="For demos on a device without a camera">Simulate (demo)</button>
          </div>
        </div>
      )}
    </div>
  );
}
