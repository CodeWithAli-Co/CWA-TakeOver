import { useEffect, useRef } from "react";

/**
 * Enhances a scrollable container:
 *   · space-held + drag   → grab-scroll (pans via scrollLeft/scrollTop)
 *   · middle-button drag  → grab-scroll
 *   · shift + wheel       → horizontal scroll (browsers without native support)
 *
 * Native vertical scroll still works out of the box.
 */
export function usePanZoom(container: React.RefObject<HTMLDivElement | null>) {
  const draggingRef = useRef(false);
  const spaceDownRef = useRef(false);
  const lastRef = useRef<{ x: number; y: number } | null>(null);

  useEffect(() => {
    const el = container.current;
    if (!el) return;

    const onWheel = (e: WheelEvent) => {
      // Shift-wheel → horizontal (nicer on mice without x-axis support).
      if (e.shiftKey && e.deltaY !== 0 && e.deltaX === 0) {
        e.preventDefault();
        el.scrollLeft += e.deltaY;
      }
    };

    const onMouseDown = (e: MouseEvent) => {
      if (e.button === 1 || (e.button === 0 && spaceDownRef.current)) {
        draggingRef.current = true;
        lastRef.current = { x: e.clientX, y: e.clientY };
        el.style.cursor = "grabbing";
        e.preventDefault();
      }
    };

    const onMouseMove = (e: MouseEvent) => {
      if (!draggingRef.current || !lastRef.current) return;
      const dx = e.clientX - lastRef.current.x;
      const dy = e.clientY - lastRef.current.y;
      lastRef.current = { x: e.clientX, y: e.clientY };
      el.scrollLeft -= dx;
      el.scrollTop -= dy;
    };

    const onMouseUp = () => {
      draggingRef.current = false;
      lastRef.current = null;
      el.style.cursor = spaceDownRef.current ? "grab" : "";
    };

    const onKeyDown = (e: KeyboardEvent) => {
      if (e.code === "Space" && !spaceDownRef.current) {
        const target = e.target as HTMLElement | null;
        if (target && ["INPUT", "TEXTAREA"].includes(target.tagName)) return;
        spaceDownRef.current = true;
        el.style.cursor = "grab";
      }
    };
    const onKeyUp = (e: KeyboardEvent) => {
      if (e.code === "Space") {
        spaceDownRef.current = false;
        if (!draggingRef.current) el.style.cursor = "";
      }
    };

    el.addEventListener("wheel", onWheel, { passive: false });
    el.addEventListener("mousedown", onMouseDown);
    window.addEventListener("mousemove", onMouseMove);
    window.addEventListener("mouseup", onMouseUp);
    window.addEventListener("keydown", onKeyDown);
    window.addEventListener("keyup", onKeyUp);

    return () => {
      el.removeEventListener("wheel", onWheel);
      el.removeEventListener("mousedown", onMouseDown);
      window.removeEventListener("mousemove", onMouseMove);
      window.removeEventListener("mouseup", onMouseUp);
      window.removeEventListener("keydown", onKeyDown);
      window.removeEventListener("keyup", onKeyUp);
    };
  }, [container]);
}
