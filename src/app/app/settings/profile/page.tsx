import { notFound } from 'next/navigation';
import { getCurrentUser } from '@/server/auth/session';
import { ProfileForm } from '@/components/settings/profile-form';

export default async function ProfileSettingsPage() {
  const user = await getCurrentUser();
  if (!user) notFound();

  return <ProfileForm name={user.name} email={user.email} />;
}
