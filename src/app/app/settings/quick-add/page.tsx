import type { Metadata } from 'next';
import { QuickAddForm } from '@/components/settings/quick-add-form';

export const metadata: Metadata = { title: 'הוספת משימה · הגדרות · סדר' };

export default function QuickAddSettingsPage() {
  return <QuickAddForm />;
}
