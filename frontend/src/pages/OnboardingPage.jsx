import { Link } from 'react-router-dom';

export default function OnboardingPage() {
  return (
    <main className="min-h-screen bg-[#050b24] px-5 py-10 text-white">
      <section className="mx-auto flex max-w-xl flex-col gap-6 rounded-[28px] border border-[#d8ad4f] bg-[#07163f]/90 p-6 shadow-[0_18px_44px_rgba(0,0,0,0.35)]">
        <div>
          <p className="text-sm font-black uppercase tracking-[0.24em] text-[#5fe5ff]">Eigo Quest</p>
          <h1 className="mt-2 text-3xl font-black text-[#ffe680]">はじめましょう</h1>
          <p className="mt-3 text-sm font-bold leading-7 text-[#dbe7ff]">
            保護者アカウントでログインして、学習を続けます。
          </p>
        </div>
        <Link
          to="/parent-login"
          className="rounded-full border border-[#f5c85b] bg-gradient-to-b from-[#ffe58d] to-[#b97812] px-5 py-3 text-center text-base font-black text-[#201200] shadow-[0_10px_22px_rgba(245,200,91,0.28)]"
        >
          ログインへ
        </Link>
      </section>
    </main>
  );
}
