import type { Metadata } from 'next';
import { requireAdministrator } from '@/server/admin/access';

export const metadata: Metadata = { title: 'ניהול · סדר', robots: { index: false, follow: false, nocache: true } };

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  await requireAdministrator();
  return children;
}
