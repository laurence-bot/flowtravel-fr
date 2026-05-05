import { useEffect, useRef } from "react";

/**
 * Sauvegarde et restaure la position de scroll d'une page.
 * Utilise sessionStorage pour persister entre les changements d'onglet.
 *
 * @param key — clé unique par page (ex: "cotation-{id}")
 */
export function useScrollRestore(key: string) {
  const scrollKey = `scroll-restore:${key}`;
  const rafRef = useRef<number | null>(null);

  // Sauvegarde la position lors du scroll (throttlé via rAF)
  useEffect(() => {
    const handleScroll = () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
      rafRef.current = requestAnimationFrame(() => {
        sessionStorage.setItem(scrollKey, String(window.scrollY));
      });
    };

    window.addEventListener("scroll", handleScroll, { passive: true });
    return () => {
      window.removeEventListener("scroll", handleScroll);
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
    };
  }, [scrollKey]);

  // Restaure la position au montage
  useEffect(() => {
    const saved = sessionStorage.getItem(scrollKey);
    if (!saved) return;
    const y = parseInt(saved, 10);
    if (!Number.isFinite(y) || y <= 0) return;

    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        window.scrollTo({ top: y, behavior: "instant" });
      });
    });
  }, [scrollKey]);
}
