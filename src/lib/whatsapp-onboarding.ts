export function shouldIntroduceWhatsapp(user: {
  phone: string | null;
  whatsappReminders: boolean;
  whatsappIntroSeenAt: Date | null;
}): boolean {
  return !user.whatsappIntroSeenAt && (!user.phone || !user.whatsappReminders);
}
