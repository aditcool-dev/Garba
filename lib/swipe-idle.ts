export async function waitForSwipeIdle(): Promise<void> {
  if (typeof document === "undefined" || document.documentElement.dataset.dragging !== "true") return;
  await new Promise<void>((resolve) => {
    const settle = () => { if (document.documentElement.dataset.dragging === "true") return; window.removeEventListener("garbamate:swipe-settled",settle); resolve(); };
    window.addEventListener("garbamate:swipe-settled",settle);
  });
}
