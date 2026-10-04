import Image from 'next/image';

export function WhatsappPreview() {
  return (
    <figure>
      <Image
        src="/seder/images/whatsapp-reminder-preview.webp"
        width={1448}
        height={1086}
        alt="דוגמה להודעה בוואטסאפ מסדר: תזכורת להכין את המצגת, מתחיל בשעה 15:30"
        className="h-auto w-full rounded-xl border border-line"
      />
      <figcaption className="mt-1.5 text-center text-xs text-muted">כך נראית תזכורת · תמונה להמחשה</figcaption>
    </figure>
  );
}
