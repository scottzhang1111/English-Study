import HeaderBar from '../components/HeaderBar';
import { motion } from 'framer-motion';

export default function HatchPage() {
  return (
    <div className="mx-auto max-w-4xl px-4 pb-32 pt-6 sm:px-6">
      <HeaderBar subtitle="孵化" />
      <motion.section initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="panel px-6 py-8 text-center">
        <div className="mx-auto flex h-44 w-44 items-center justify-center rounded-full bg-[#e7f6ff] text-4xl font-black text-[#354172] shadow-[inset_0_-14px_24px_rgba(173,216,255,0.35)]">
          EV
        </div>
        <h2 className="display-font mt-6 text-4xl font-extrabold text-[#354172]">新しいペットを準備中です</h2>
        <p className="mt-3 leading-7 text-[#6f7da8]">
          ここは準備画面です。学習を進めると、新しいペットが解放されます。
        </p>
      </motion.section>
    </div>
  );
}
