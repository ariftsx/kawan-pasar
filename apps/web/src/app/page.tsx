import { DemoCostCard } from './demo-cost-card';

export default function HomePage() {
  return (
    <main className="mx-auto flex min-h-dvh max-w-3xl flex-col gap-6 p-4 md:p-8">
      <header className="flex flex-col gap-2">
        <p className="text-text-brand text-xs font-semibold tracking-widest uppercase">
          Kawan Pasar
        </p>
        <h1 className="text-3xl font-semibold tracking-tight">
          Modal menu Anda, hari ini dan minggu depan
        </h1>
        <p className="text-text-secondary">
          Aplikasi sedang dibangun. Contoh di bawah dihitung dengan aturan yang sama dengan aplikasi
          nanti.
        </p>
      </header>
      <DemoCostCard />
    </main>
  );
}
