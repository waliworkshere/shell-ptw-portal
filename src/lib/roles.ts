import { Role } from './types';

export const ROLE_HOME: Record<Role, string> = {
  ADMIN: '/admin/dashboard',
  ARTELIA_MANAGER: '/approver/dashboard',
  COMPANY_MANAGER: '/approver/dashboard',
  APPROVER: '/approver/dashboard',
  STATION: '/station/dashboard',
  APPLICANT: '/applicant/dashboard',
  TRAINEE: '/training',
};

export function maskCivilId(id: string) {
  if (!id) return '—';
  return id.length <= 4 ? id : `${'•'.repeat(id.length - 4)}${id.slice(-4)}`;
}

export function initials(name: string) {
  return name
    .split(' ')
    .filter((p) => p && !/^al$/i.test(p))
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase())
    .join('');
}

export function greeting() {
  const h = new Date().getHours();
  return h < 12 ? 'Good morning' : h < 17 ? 'Good afternoon' : 'Good evening';
}

export function omr(n: number) {
  return `${n.toFixed(3)} OMR`;
}
