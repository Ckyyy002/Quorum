import type { ReactNode } from 'react';

/** Split screen from the approved mockup: dark hero on the left, the form card on the right. */
export function AuthLayout({ children }: { children: ReactNode }) {
  return (
    <div className="flex min-h-svh flex-col bg-background lg:flex-row">
      <section className="flex flex-col justify-between gap-10 bg-[#121212] px-6 py-8 text-[#fdfaf0] lg:w-1/2 lg:px-16 lg:py-14">
        <div className="flex items-center gap-3">
          <img src="/logo-on-dark.svg" alt="" className="size-10" />
          <div className="flex flex-col leading-tight">
            <span className="text-lg font-extrabold tracking-tight">Quorum</span>
            <span className="text-xs text-[#fdfaf0]/70">HMTC ITS</span>
          </div>
        </div>
        <div className="flex max-w-xl flex-col gap-5">
          <span className="self-start rounded-full bg-brand-yellow px-3 py-1 text-xs font-bold tracking-wider text-foreground">
            KABINET NIAT BAIK 2026/2027
          </span>
          <h1 className="text-3xl leading-tight font-bold uppercase lg:text-5xl">
            Membawa perubahan positif &amp; progresif
          </h1>
          <p className="hidden text-base leading-relaxed text-[#fdfaf0]/80 lg:block">
            Satu tempat untuk proker, task, proposal dan LPJ, rapat, serta presensi seluruh
            fungsionaris HMTC.
          </p>
        </div>
        <div className="hidden lg:block" />
      </section>
      <main className="flex flex-1 items-start justify-center px-4 py-8 lg:items-center lg:px-6">
        <div className="w-full max-w-md rounded-2xl border bg-card p-6 lg:p-10">{children}</div>
      </main>
    </div>
  );
}
