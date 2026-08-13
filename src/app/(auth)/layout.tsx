import Link from 'next/link';

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="grid min-h-dvh grid-rows-[auto_1fr] bg-paper">
      <header className="px-6 py-6">
        <Link href="/" className="display inline-block text-2xl font-bold text-ink">
          סדר
        </Link>
      </header>
      <main className="flex items-start justify-center px-6 pb-16">
        <div className="w-full max-w-sm">{children}</div>
      </main>
    </div>
  );
}
