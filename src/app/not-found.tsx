import Link from 'next/link';

export default function NotFound() {
  return (
    <div className="grid min-h-dvh place-items-center bg-paper px-6">
      <div className="text-center">
        <h1 className="display text-3xl font-bold text-ink">הדף הזה לא קיים</h1>
        <p className="mt-2 text-muted">אולי הקישור השתנה, או שהפריט נמחק.</p>
        <Link
          href="/app/today"
          className="mt-6 inline-flex h-11 items-center rounded-lg bg-accent px-5 font-semibold text-[var(--on-accent)] transition-colors hover:bg-accent-hover"
        >
          חזרה להיום
        </Link>
      </div>
    </div>
  );
}
