'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

// The profile now lives at /profile (shared by Permit Holders and Trainees).
export default function ApplicantProfileRedirect() {
  const router = useRouter();
  useEffect(() => router.replace('/profile'), [router]);
  return null;
}
