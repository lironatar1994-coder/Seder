import { notFound } from 'next/navigation';
import { getCurrentUser } from '@/server/auth/session';
import { AppearanceForm } from '@/components/settings/appearance-form';

export default async function AppearanceSettingsPage() {
  const user = await getCurrentUser();
  if (!user) notFound();

  return <AppearanceForm defaultView={user.defaultView} />;
}
