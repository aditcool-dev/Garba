import { describe, expect, it } from "vitest";
import { decideSwipe } from "../components/swipe-card";

describe("swipe release projection", () => {
  it("commits in the projected gesture direction, including fast short flicks", () => {
    expect(decideSwipe(-150, 0)).toBe("pass");
    expect(decideSwipe(150, 0)).toBe("like");
    expect(decideSwipe(-30, -600)).toBe("pass");
    expect(decideSwipe(30, 600)).toBe("like");
    expect(decideSwipe(-160, 100)).toBe("pass");
    expect(decideSwipe(160, -100)).toBe("like");
  });
  it("springs back below threshold and gives a dominant upward gesture to Vibe", () => {
    expect(decideSwipe(90, 0)).toBeNull();
    expect(decideSwipe(-120, 0)).toBeNull();
    expect(decideSwipe(10, 0, -150, 0)).toBe("vibe");
    expect(decideSwipe(160, 0, -140, 0)).toBe("like");
    expect(decideSwipe(0, 0, 180, 0)).toBeNull();
  });
});
