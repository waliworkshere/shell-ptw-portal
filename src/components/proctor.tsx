'use client';

/**
 * Course proctoring: when a learner starts a course they are asked to turn on
 * their camera. The stream lives here (above the routes) so the small
 * self-view keeps running while they move between lessons.
 */
import { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';
import { Camera, CameraOff, Minimize2, Maximize2 } from 'lucide-react';

interface ProctorCtx {
  active: boolean;
  courseLabel: string | null;
  start: (courseLabel: string) => Promise<boolean>;
  stop: () => void;
  stream: MediaStream | null;
}

const Ctx = createContext<ProctorCtx | null>(null);

export function ProctorProvider({ children }: { children: React.ReactNode }) {
  const [stream, setStream] = useState<MediaStream | null>(null);
  const [courseLabel, setCourseLabel] = useState<string | null>(null);

  const start = useCallback(async (label: string) => {
    setCourseLabel(label);
    if (stream) return true;
    try {
      const s = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'user' }, audio: false });
      setStream(s);
      return true;
    } catch {
      return false;
    }
  }, [stream]);

  const stop = useCallback(() => {
    stream?.getTracks().forEach((t) => t.stop());
    setStream(null);
    setCourseLabel(null);
  }, [stream]);

  return <Ctx.Provider value={{ active: !!stream, courseLabel, start, stop, stream }}>{children}</Ctx.Provider>;
}

export function useProctor() {
  const c = useContext(Ctx);
  if (!c) throw new Error('useProctor must be inside ProctorProvider');
  return c;
}

/** Floating self-view shown on every page while a course session is on camera. */
export function ProctorPip() {
  const { stream, courseLabel, stop } = useProctor();
  const ref = useRef<HTMLVideoElement>(null);
  const [small, setSmall] = useState(false);

  useEffect(() => {
    if (ref.current && stream) ref.current.srcObject = stream;
  });

  if (!stream) return null;
  return (
    <div className={`fixed bottom-24 end-5 z-[60] overflow-hidden rounded-2xl bg-ink shadow-2xl ring-2 ring-leaf-400 transition-all no-print ${small ? 'w-36' : 'w-56'}`}>
      <video ref={ref} autoPlay playsInline muted className="aspect-[4/3] w-full -scale-x-100 object-cover" />
      <div className="absolute left-2 top-2 flex items-center gap-1 rounded-full bg-rust-500 px-2 py-0.5 text-[10px] font-semibold text-white">
        <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-white" /> REC
      </div>
      <div className="flex items-center justify-between gap-1 px-2 py-1.5">
        <p className="truncate text-[10px] text-white/70">
          <Camera size={10} className="mr-1 inline" />
          {courseLabel ?? 'Course on camera'}
        </p>
        <div className="flex shrink-0 gap-0.5">
          <button onClick={() => setSmall((v) => !v)} className="rounded p-1 text-white/60 hover:bg-white/10 hover:text-white" aria-label={small ? 'Enlarge' : 'Shrink'}>
            {small ? <Maximize2 size={11} /> : <Minimize2 size={11} />}
          </button>
          <button onClick={stop} className="rounded p-1 text-white/60 hover:bg-white/10 hover:text-white" aria-label="Turn camera off" title="Turn camera off">
            <CameraOff size={11} />
          </button>
        </div>
      </div>
    </div>
  );
}
