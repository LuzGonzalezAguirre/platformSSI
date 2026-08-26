import { useState, useEffect } from "react";

/**
 * Estado + manejo de ESC para paneles en pantalla completa. Extraido del
 * patron que ya existia inline en ScrapRatePage.tsx -- misma logica,
 * reusable para cualquier grafica individual (COGP Trend/Pareto, etc.).
 * No toca ScrapRatePage.tsx: esa pantalla sigue con su implementacion
 * propia para no arriesgar una pantalla que ya funciona.
 */
export function useFullscreen() {
  const [fullscreen, setFullscreen] = useState(false);

  useEffect(() => {
    if (!fullscreen) return;
    const onKey = (ev: KeyboardEvent) => {
      if (ev.key === "Escape") setFullscreen(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [fullscreen]);

  return { fullscreen, enterFullscreen: () => setFullscreen(true), exitFullscreen: () => setFullscreen(false) };
}