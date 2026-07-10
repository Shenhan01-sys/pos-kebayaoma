"use client";

import { useEffect, useState } from "react";

export default function LoadingScreen() {
  const [leaving, setLeaving] = useState(false);
  const [gone, setGone] = useState(false);
  const [pct, setPct] = useState(0);
  const [imgErr, setImgErr] = useState(false);

  useEffect(() => {
    const start = Date.now();
    const dur = 2000;
    let raf = 0;
    const tick = () => {
      const p = Math.min(100, Math.round(((Date.now() - start) / dur) * 100));
      setPct(p);
      if (p < 100) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    const t1 = setTimeout(() => setLeaving(true), 2100);
    const t2 = setTimeout(() => setGone(true), 2700);
    return () => {
      cancelAnimationFrame(raf);
      clearTimeout(t1);
      clearTimeout(t2);
    };
  }, []);

  if (gone) return null;

  return (
    <div
      className={`fixed inset-0 z-[100] flex items-center justify-center bg-[#FDF7E9] transition-opacity duration-500 ${
        leaving ? "opacity-0" : "opacity-100"
      }`}
    >
      {/* Decorative solid blobs */}
      <div className="pointer-events-none absolute -right-24 -top-24 h-80 w-80 rounded-full bg-custard/40" />
      <div className="pointer-events-none absolute -left-24 -bottom-24 h-80 w-80 rounded-full bg-olive/10" />

      <div className="relative w-[640px] max-w-[94vw] rounded-[28px] bg-[#FDF7E9] p-10 text-center">
        <div className="relative">
          {/* Enlarged logo — acts as logo + header */}
          <div className="mx-auto flex h-[480px] w-full items-center justify-center">
            {imgErr ? (
              <span className="text-7xl">🪡</span>
            ) : (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src="/logo-brand.png"
                alt="Kebaya Oma"
                className="h-[460px] w-[460px] max-w-full object-contain"
                onError={() => setImgErr(true)}
              />
            )}
          </div>

          <h1 className="mt-3 font-serif text-2xl font-bold uppercase tracking-[0.18em] text-[#AD703D]">
            Kebaya Oma
          </h1>

          <div className="mt-2 flex items-center justify-center gap-2 text-[#AD703D]">
            <span className="h-px w-8 bg-[#AD703D]/40" />
            <span className="text-xs font-semibold uppercase tracking-[0.35em]">Pos</span>
            <span className="h-px w-8 bg-[#AD703D]/40" />
          </div>

          <p className="mt-3 text-[11px] italic text-olive/80">
            Warisan Kebaya Nusantara · Est. 2024
          </p>

          {/* Progress */}
          <div className="mt-6 h-1.5 w-full overflow-hidden rounded-full bg-olive/15">
            <div
              className="h-1.5 rounded-full bg-apricot transition-[width] duration-100 ease-out"
              style={{ width: `${pct}%` }}
            />
          </div>
          <div className="mt-2 text-[11px] text-olive/70 tnum">{pct}%</div>
        </div>
      </div>
    </div>
  );
}
