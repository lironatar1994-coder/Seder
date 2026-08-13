import { otherSessionCount } from '@/server/settings/actions';
import { AccountForm } from '@/components/settings/account-form';

export default async function AccountSettingsPage() {
  const others = await otherSessionCount();
  return <AccountForm otherSessions={others} />;
}
