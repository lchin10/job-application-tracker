import { useEffect, useState, type RefObject } from "react";

interface Props {
  /** The scroll container to control (the table pane). */
  targetRef: RefObject<HTMLElement | null>;
  /** Shift left of the detail panel when it's open. */
  panelOpen?: boolean;
}

/**
 * Fixed bottom-right bubble: ↑ scrolls the target to the top, ↓ to the bottom.
 * The up arrow fades in only after the target has scrolled down a bit.
 */
export default function ScrollFab({ targetRef, panelOpen }: Props) {
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const el = targetRef.current;
    if (!el) return;
    const onScroll = () => setScrolled(el.scrollTop > 200);
    onScroll();
    el.addEventListener("scroll", onScroll, { passive: true });
    return () => el.removeEventListener("scroll", onScroll);
  }, [targetRef]);

  const toTop = () => targetRef.current?.scrollTo({ top: 0, behavior: "smooth" });
  const toBottom = () =>
    targetRef.current?.scrollTo({
      top: targetRef.current.scrollHeight,
      behavior: "smooth",
    });

  return (
    <div className={panelOpen ? "scroll-fab is-shifted" : "scroll-fab"}>
      <button
        className={scrolled ? "fab-btn" : "fab-btn is-hidden"}
        onClick={toTop}
        aria-label="Scroll to top"
        title="Scroll to top"
      >
        ↑
      </button>
      <button
        className="fab-btn"
        onClick={toBottom}
        aria-label="Scroll to bottom"
        title="Scroll to bottom"
      >
        ↓
      </button>
    </div>
  );
}
