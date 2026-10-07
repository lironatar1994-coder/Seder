export default function AdminLoading() {
  return <main className="mx-auto max-w-5xl px-6 py-12" aria-busy="true" aria-label="טעינת נתוני הניהול"><div className="h-8 w-32 rounded bg-surface-2" /><div className="mt-10 grid grid-cols-2 gap-6 md:grid-cols-4">{[0, 1, 2, 3].map((key) => <div key={key} className="h-24 rounded bg-surface-2" />)}</div><div className="mt-8 h-56 rounded bg-surface-2" /></main>;
}
