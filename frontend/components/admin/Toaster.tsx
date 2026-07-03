"use client";
import { useEffect, useState } from "react";

type T = { id: number; message: string; type: string };

export default function Toaster() {
  const [toasts, setToasts] = useState<T[]>([]);

  useEffect(() => {
    let n = 0;
    const handler = (e: Event) => {
      const detail = (e as CustomEvent).detail as { message: string; type: string };
      const id = ++n;
      setToasts((t) => [...t, { id, ...detail }]);
      setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), 3200);
    };
    window.addEventListener("fv-toast", handler);
    return () => window.removeEventListener("fv-toast", handler);
  }, []);

  return (
    <div className="adm-toaster">
      {toasts.map((t) => (
        <div key={t.id} className={"adm-toast " + (t.type === "err" ? "err" : "ok")} onClick={() => setToasts((x) => x.filter((y) => y.id !== t.id))}>
          {t.message}
        </div>
      ))}
    </div>
  );
}
