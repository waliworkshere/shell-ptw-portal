'use client';

import { useState } from 'react';
import { Course } from '@/lib/types';
import { Modal } from './modal';
import { CameraWarning, FaceVerify } from './face-verify';
import { useProctor } from './proctor';
import { ArrowRight, Camera, ScanFace, Video } from 'lucide-react';

/** Shown before a course starts: warnings → face verification → camera on. */
export function CourseGate({ course, open, onClose, onReady }: { course: Course; open: boolean; onClose: () => void; onReady: () => void }) {
  const proctor = useProctor();
  const [stage, setStage] = useState<'intro' | 'face' | 'camera'>('intro');
  const [camFail, setCamFail] = useState(false);

  async function startCam() {
    const ok = await proctor.start(`${course.code} · on camera`);
    if (!ok) return setCamFail(true);
    onReady();
  }

  return (
    <Modal
      open={open}
      onClose={() => {
        setStage('intro');
        onClose();
      }}
      title={
        <span className="flex items-center gap-2">
          {stage === 'face' ? <ScanFace size={20} /> : <Video size={20} />} {stage === 'face' ? 'Face verification' : 'Before you begin'}
        </span>
      }
    >
      {stage === 'intro' && (
        <div className="space-y-4">
          <p className="text-sm text-slate-600">
            <b className="text-ink">{course.title}</b> is a supervised course. We confirm it&apos;s really you, then keep your camera on while you learn.
          </p>
          <CameraWarning compact />
          <ol className="space-y-2 text-sm">
            {[
              [ScanFace, 'Verify your face against your Civil ID profile'],
              [Camera, 'Keep your camera on for the whole course'],
            ].map(([I, t], i) => {
              const Icon = I as React.ElementType;
              return (
                <li key={i} className="flex items-center gap-3 rounded-lg border border-petrol-100 px-3 py-2">
                  <span className="flex h-6 w-6 items-center justify-center rounded-full bg-petrol-500 text-xs font-semibold text-white">{i + 1}</span>
                  <Icon size={16} className="text-petrol-500" /> {t as string}
                </li>
              );
            })}
          </ol>
          <button onClick={() => setStage('face')} className="btn-primary w-full py-2.5">
            I understand, continue <ArrowRight size={15} />
          </button>
        </div>
      )}
      {stage === 'face' && <FaceVerify context={`Course start ${course.code}`} onCancel={() => setStage('intro')} onComplete={() => setStage('camera')} />}
      {stage === 'camera' && (
        <div className="space-y-4">
          <CameraWarning compact />
          <p className="text-sm text-slate-600">Your camera will now stay on in a small window while you study. You can move between lessons freely.</p>
          {camFail && <p className="rounded-lg bg-rust-50 px-3 py-2 text-sm text-rust-600">Camera unavailable. In the prototype you can continue without it.</p>}
          <div className="flex gap-2">
            {camFail && <button onClick={onReady} className="btn-secondary flex-1">Continue without camera</button>}
            <button onClick={startCam} className="btn-primary flex-1 py-2.5"><Camera size={16} /> Turn on camera &amp; start</button>
          </div>
        </div>
      )}
    </Modal>
  );
}
