import { ApplicationStatus, STATUS_LABEL } from '@/lib/types';

export function StatusStamp({ status }: { status: ApplicationStatus }) {
  return <span className={`stamp stamp-${status.toLowerCase()}`}>{STATUS_LABEL[status]}</span>;
}
