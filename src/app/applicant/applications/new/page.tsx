'use client';

import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { RoleGuard } from '@/components/role-guard';
import { useStore } from '@/lib/store';
import { RISK_DESCRIPTION, RISK_LABEL, RiskLevel, UploadedDocument, jhaRequired } from '@/lib/types';
import { ArrowLeft, ArrowRight, Camera, CheckCircle2, Lightbulb, Loader2, ScanText, Upload, Video } from 'lucide-react';
import { matchFields, readDocument } from '@/lib/ocr';
import { OcrUploadButton } from '@/components/ocr-upload';

const STEPS = ['Station', 'Permit type', 'Risk level', 'Details', 'Documents', 'Review'];

function OnSiteDocPicker({
  label,
  required,
  doc,
  onFile,
  onCapture,
  reading = false,
}: {
  reading?: boolean;
  label: string;
  required: boolean;
  doc?: UploadedDocument;
  onFile: (file: File | null) => void;
  onCapture: (dataUrl: string, fileName: string) => void;
}) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const [capturing, setCapturing] = useState(false);
  // Attach the stream after the <video> element has rendered (fixes the black preview).
  useEffect(() => {
    if (capturing && videoRef.current && streamRef.current && videoRef.current.srcObject !== streamRef.current) videoRef.current.srcObject = streamRef.current;
  });

  async function startCamera() {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' } });
      streamRef.current = stream;
      if (videoRef.current) videoRef.current.srcObject = stream;
      setCapturing(true);
    } catch {
      alert('Camera unavailable in this browser/device — use "Choose file" instead.');
    }
  }

  function stopCamera() {
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
    setCapturing(false);
  }

  function snap() {
    const video = videoRef.current;
    if (!video) return;
    const canvas = document.createElement('canvas');
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    canvas.getContext('2d')?.drawImage(video, 0, 0);
    const dataUrl = canvas.toDataURL('image/png');
    onCapture(dataUrl, `${label.replace(/\s+/g, '_')}_${Date.now()}.png`);
    stopCamera();
  }

  return (
    <div className="rounded-lg border border-dashed border-petrol-100 bg-petrol-50/30 p-4">
      <p className="text-xs font-medium text-ink">
        {label}
        {required && <span className="text-rust-500"> *</span>}
      </p>

      {capturing ? (
        <div className="mt-2">
          <video ref={videoRef} autoPlay playsInline className="aspect-video w-full rounded-md bg-ink object-cover" />
          <div className="mt-2 flex gap-2">
            <button type="button" onClick={snap} className="btn-primary flex-1 text-xs">
              <Camera size={14} /> Capture
            </button>
            <button type="button" onClick={stopCamera} className="btn-secondary text-xs">
              Cancel
            </button>
          </div>
        </div>
      ) : doc ? (
        <div className="mt-2 flex items-center gap-2 rounded-md bg-white px-3 py-2 text-xs">
          <CheckCircle2 size={16} className="shrink-0 text-petrol-500" />
          <span className="truncate">{doc.fileName}</span>
          {reading ? (
            <span className="ml-auto inline-flex shrink-0 items-center gap-1 text-slate-400"><Loader2 size={12} className="animate-spin" /> reading</span>
          ) : doc.ocrText ? (
            <span className="ml-auto inline-flex shrink-0 items-center gap-1 text-leaf-700" title="Text read automatically for the Permit Issuer"><ScanText size={12} /> text read</span>
          ) : null}
        </div>
      ) : (
        <div className="mt-2 flex gap-2">
          <label className="flex flex-1 cursor-pointer items-center justify-center gap-1.5 rounded-md border border-petrol-100 bg-white px-2 py-2 text-xs text-slate-500 hover:bg-petrol-50">
            <Upload size={13} /> Choose file
            <input type="file" accept="image/*,application/pdf" className="hidden" onChange={(e) => onFile(e.target.files?.[0] ?? null)} />
          </label>
          <button type="button" onClick={startCamera} className="flex flex-1 items-center justify-center gap-1.5 rounded-md border border-petrol-100 bg-white px-2 py-2 text-xs text-slate-500 hover:bg-petrol-50">
            <Camera size={13} /> Use camera
          </button>
        </div>
      )}
      {doc && !capturing && (
        <button type="button" className="mt-1.5 text-[11px] text-slate-400 hover:text-ink" onClick={() => onFile(null)}>
          Replace
        </button>
      )}
    </div>
  );
}

export default function NewApplicationPage() {
  const { state, createApplication } = useStore();
  const router = useRouter();

  const [step, setStep] = useState(0);
  const [stationId, setStationId] = useState('');
  const [permitTypeId, setPermitTypeId] = useState('');
  const [riskLevel, setRiskLevel] = useState<RiskLevel | null>(null);
  const [fieldValues, setFieldValues] = useState<Record<string, string>>({});
  const [documents, setDocuments] = useState<UploadedDocument[]>([]);
  const [wcfDocument, setWcfDocument] = useState<UploadedDocument | undefined>();
  const [jhaDocument, setJhaDocument] = useState<UploadedDocument | undefined>();

  const permitType = state.permitTypes.find((p) => p.id === permitTypeId);
  const needsJha = riskLevel ? jhaRequired(riskLevel) : false;

  function canProceed() {
    if (step === 0) return !!stationId;
    if (step === 1) return !!permitTypeId;
    if (step === 2) return !!riskLevel;
    if (step === 3) return (permitType?.fields ?? []).filter((f) => f.required).every((f) => fieldValues[f.key]?.trim());
    if (step === 4) {
      const requiredDocs = permitType?.documents.filter((d) => d.required) ?? [];
      const uploadedKeys = documents.map((d) => d.key);
      const docsOk = requiredDocs.every((d) => uploadedKeys.includes(d.key));
      return docsOk && !!wcfDocument && (!needsJha || !!jhaDocument);
    }
    return true;
  }

  const [reading, setReading] = useState<Record<string, boolean>>({});
  const [autoFilled, setAutoFilled] = useState('');

  /** Fills empty detail fields with anything that matches on a scanned document. */
  function autofill(text: string) {
    const found = matchFields(text, (permitType?.fields ?? []).map((f) => ({ key: f.key, label: f.label, date: f.fieldType === 'DATE' })));
    let n = 0;
    setFieldValues((v) => {
      const next = { ...v };
      for (const [k, val] of Object.entries(found)) if (!next[k]?.trim()) { next[k] = val; n++; }
      return next;
    });
    return Object.keys(found).length || n;
  }

  /** Reads an uploaded / photographed document with OCR so the Permit Issuer can search its text. */
  async function readInto(key: string, source: File | string, fileName: string) {
    setReading((r) => ({ ...r, [key]: true }));
    try {
      const file = typeof source === 'string' ? new File([await (await fetch(source)).blob()], fileName, { type: 'image/png' }) : source;
      const r = await readDocument(file);
      const patch = (d?: UploadedDocument) => (d && d.fileName === fileName ? { ...d, ocrText: r.text.slice(0, 3000), dataUrl: d.dataUrl ?? r.preview } : d);
      if (key === 'wcf') setWcfDocument(patch);
      else if (key === 'jha') setJhaDocument(patch);
      else setDocuments((docs) => docs.map((d) => (d.key === key ? patch(d)! : d)));
      if (r.text) autofill(r.text);
    } catch {
      // OCR is a convenience — the upload itself still counts.
    } finally {
      setReading((r) => ({ ...r, [key]: false }));
    }
  }

  function handleFileSelect(key: string, label: string, file: File | null) {
    if (!file) {
      setDocuments((docs) => docs.filter((d) => d.key !== key));
      return;
    }
    setDocuments((docs) => [...docs.filter((d) => d.key !== key), { key, label, fileName: file.name }]);
    void readInto(key, file, file.name);
  }

  function handleSubmit() {
    if (!riskLevel) return;
    const created = createApplication({
      stationId,
      permitTypeId,
      riskLevel,
      fieldValues,
      documents,
      wcfDocument,
      jhaDocument,
      videoRecorded: false,
    });
    router.push(`/applicant/applications/${created.id}`);
  }

  return (
    <RoleGuard role="APPLICANT">
      <div className="mx-auto max-w-2xl px-4 py-6 sm:px-8 sm:py-10">
        <h1 className="font-display text-xl font-semibold text-ink">New permit application</h1>

        <div className="mt-6 flex items-center gap-1.5">
          {STEPS.map((s, i) => (
            <div key={s} className="flex flex-1 items-center gap-1.5">
              <div
                className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-[11px] font-semibold ${
                  i < step ? 'bg-petrol-500 text-white' : i === step ? 'border-2 border-petrol-500 text-petrol-500' : 'border border-petrol-100 text-slate-400'
                }`}
              >
                {i < step ? <CheckCircle2 size={13} /> : i + 1}
              </div>
              {i < STEPS.length - 1 && <div className={`h-px flex-1 ${i < step ? 'bg-petrol-500' : 'bg-petrol-100'}`} />}
            </div>
          ))}
        </div>
        <p className="mt-2 text-xs font-medium uppercase tracking-wide text-slate-400">{STEPS[step]}</p>

        <div className="card mt-4">
          {step === 0 && (
            <div className="space-y-2">
              <p className="mb-3 text-sm text-slate-500">Which fuel station is this permit for?</p>
              {state.stations.map((s) => (
                <label
                  key={s.id}
                  className={`flex cursor-pointer items-center justify-between rounded-lg border px-4 py-3 text-sm transition ${
                    stationId === s.id ? 'border-petrol-500 bg-petrol-50' : 'border-petrol-100 hover:bg-petrol-50/50'
                  }`}
                >
                  <div>
                    <p className="font-medium text-ink">{s.name}</p>
                    <p className="text-xs text-slate-400">{s.location}</p>
                  </div>
                  <input type="radio" name="station" checked={stationId === s.id} onChange={() => setStationId(s.id)} />
                </label>
              ))}
            </div>
          )}

          {step === 1 && (
            <div className="space-y-2">
              <p className="mb-3 text-sm text-slate-500">What type of permit do you need?</p>
              {state.permitTypes.filter((p) => p.active).map((p) => (
                <label
                  key={p.id}
                  className={`flex cursor-pointer items-center justify-between rounded-lg border px-4 py-3 text-sm transition ${
                    permitTypeId === p.id ? 'border-petrol-500 bg-petrol-50' : 'border-petrol-100 hover:bg-petrol-50/50'
                  }`}
                >
                  <div>
                    <p className="font-medium text-ink">{p.name}</p>
                    <p className="text-xs text-slate-400">{p.description}</p>
                  </div>
                  <input type="radio" name="permitType" checked={permitTypeId === p.id} onChange={() => setPermitTypeId(p.id)} />
                </label>
              ))}
            </div>
          )}

          {step === 2 && (
            <div className="space-y-2">
              <p className="mb-3 text-sm text-slate-500">What&apos;s the risk intensity of this work?</p>
              {(['LOW', 'MEDIUM', 'HIGH'] as RiskLevel[]).map((r) => (
                <label
                  key={r}
                  className={`flex cursor-pointer items-center justify-between rounded-lg border px-4 py-3 text-sm transition ${
                    riskLevel === r ? 'border-petrol-500 bg-petrol-50' : 'border-petrol-100 hover:bg-petrol-50/50'
                  }`}
                >
                  <div>
                    <p className="font-medium text-ink">{RISK_LABEL[r]}</p>
                    <p className="text-xs text-slate-400">{RISK_DESCRIPTION[r]}</p>
                  </div>
                  <input type="radio" name="riskLevel" checked={riskLevel === r} onChange={() => setRiskLevel(r)} />
                </label>
              ))}
            </div>
          )}

          {step === 3 && permitType && (
            <div className="space-y-4">
              <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg bg-petrol-50 p-3 text-xs text-petrol-600">
                <span className="flex items-center gap-2"><ScanText size={16} /> Have the WCF or method statement already? Scan it and we&apos;ll fill in what we can read.</span>
                <OcrUploadButton
                  label="Fill from a document"
                  className="btn-secondary px-3 py-1.5 text-xs"
                  onRead={({ text }) => {
                    const n = text ? autofill(text) : 0;
                    setAutoFilled(n ? `Filled ${n} field${n === 1 ? '' : 's'} from the document — please check them.` : 'Nothing matched the form fields. Please type the details.');
                  }}
                />
              </div>
              {autoFilled && <p className="rounded-lg bg-sand-50 px-3 py-2 text-xs text-sand-700">{autoFilled}</p>}
              {permitType.fields.map((f) => (
                <div key={f.key}>
                  <label className="label">
                    {f.label}
                    {f.required && <span className="text-rust-500"> *</span>}
                  </label>
                  {f.fieldType === 'TEXTAREA' ? (
                    <textarea
                      className="input"
                      rows={3}
                      value={fieldValues[f.key] ?? ''}
                      onChange={(e) => setFieldValues((v) => ({ ...v, [f.key]: e.target.value }))}
                    />
                  ) : (
                    <input
                      type={f.fieldType === 'DATE' ? 'date' : 'text'}
                      className="input"
                      value={fieldValues[f.key] ?? ''}
                      onChange={(e) => setFieldValues((v) => ({ ...v, [f.key]: e.target.value }))}
                    />
                  )}
                </div>
              ))}
            </div>
          )}

          {step === 4 && permitType && (
            <div className="space-y-6">
              <div className="flex gap-2 rounded-lg border border-sand-300 bg-sand-50 p-3 text-xs text-sand-700">
                <Lightbulb size={26} className="shrink-0 text-sand-500" />
                <p>
                  The WCF (and JHA, if required) are normally filled out by hand on site, then photographed and
                  uploaded here. Use <strong>Use camera</strong> below to snap it in-browser instead of leaving
                  the app — no printer or scanner needed. Please follow Shell mobile usage guidelines: only use
                  your phone camera outside the dispenser and tanker offload areas.
                </p>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <OnSiteDocPicker
                  label="Work Clearance Form (WCF)"
                  required
                  doc={wcfDocument}
                  reading={reading.wcf}
                  onFile={(file) => {
                    setWcfDocument(file ? { key: 'wcf', label: 'Work Clearance Form (WCF)', fileName: file.name } : undefined);
                    if (file) void readInto('wcf', file, file.name);
                  }}
                  onCapture={(dataUrl, fileName) => {
                    setWcfDocument({ key: 'wcf', label: 'Work Clearance Form (WCF)', fileName, dataUrl });
                    void readInto('wcf', dataUrl, fileName);
                  }}
                />
                {needsJha && (
                  <OnSiteDocPicker
                    label="Job Hazard Analysis (JHA/RA)"
                    required
                    doc={jhaDocument}
                    reading={reading.jha}
                    onFile={(file) => {
                      setJhaDocument(file ? { key: 'jha', label: 'Job Hazard Analysis (JHA/RA)', fileName: file.name } : undefined);
                      if (file) void readInto('jha', file, file.name);
                    }}
                    onCapture={(dataUrl, fileName) => {
                      setJhaDocument({ key: 'jha', label: 'Job Hazard Analysis (JHA/RA)', fileName, dataUrl });
                      void readInto('jha', dataUrl, fileName);
                    }}
                  />
                )}
                {permitType.documents.map((d) => {
                  const uploaded = documents.find((doc) => doc.key === d.key);
                  return (
                    <OnSiteDocPicker
                      key={d.key}
                      label={d.label}
                      required={d.required}
                      doc={uploaded}
                      reading={reading[d.key]}
                      onFile={(file) => handleFileSelect(d.key, d.label, file)}
                      onCapture={(dataUrl, fileName) => {
                        setDocuments((docs) => [...docs.filter((doc) => doc.key !== d.key), { key: d.key, label: d.label, fileName, dataUrl }]);
                        void readInto(d.key, dataUrl, fileName);
                      }}
                    />
                  );
                })}
              </div>

              <div className="flex items-center gap-2 rounded-lg bg-petrol-50/50 p-3 text-xs text-slate-500">
                <Video size={16} className="shrink-0 text-petrol-400" />
                A Permit Issuer will start a live video verification call with you once these documents are
                reviewed — no video needs to be recorded here.
              </div>
            </div>
          )}

          {step === 5 && permitType && riskLevel && (
            <div className="space-y-4 text-sm">
              <p className="text-slate-500">Review your application before submitting.</p>
              <div className="rounded-lg bg-petrol-50/50 p-4">
                <p><span className="text-slate-400">Station:</span> {state.stations.find((s) => s.id === stationId)?.name}</p>
                <p><span className="text-slate-400">Permit type:</span> {permitType.name}</p>
                <p><span className="text-slate-400">Risk level:</span> {RISK_LABEL[riskLevel]}</p>
                {permitType.fields.map((f) => (
                  <p key={f.key}><span className="text-slate-400">{f.label}:</span> {fieldValues[f.key] || '—'}</p>
                ))}
                <p><span className="text-slate-400">WCF:</span> {wcfDocument?.fileName || 'Not uploaded'}</p>
                {needsJha && <p><span className="text-slate-400">JHA/RA:</span> {jhaDocument?.fileName || 'Not uploaded'}</p>}
                <p><span className="text-slate-400">Other documents:</span> {documents.map((d) => d.fileName).join(', ') || 'None'}</p>
              </div>
            </div>
          )}
        </div>

        <div className="mt-4 flex justify-between">
          <button
            onClick={() => setStep((s) => Math.max(0, s - 1))}
            disabled={step === 0}
            className="btn-secondary disabled:opacity-0"
          >
            <ArrowLeft size={16} /> Back
          </button>
          {step < STEPS.length - 1 ? (
            <button onClick={() => setStep((s) => s + 1)} disabled={!canProceed()} className="btn-primary">
              Next <ArrowRight size={16} />
            </button>
          ) : (
            <button onClick={handleSubmit} className="btn-primary">
              Submit application
            </button>
          )}
        </div>
      </div>
    </RoleGuard>
  );
}
