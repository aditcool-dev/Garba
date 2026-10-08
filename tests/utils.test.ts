import { describe, expect, it } from "vitest";
import { formatRelativeTime } from "@/lib/utils";

describe("relative notification time", () => {
  const now = Date.parse("2026-10-08T12:00:00.000Z");

  it.each([
    ["2026-10-08T11:59:45.000Z", "just now"],
    ["2026-10-08T11:59:00.000Z", "1 min ago"],
    ["2026-10-08T11:35:00.000Z", "25 mins ago"],
    ["2026-10-08T11:00:00.000Z", "1 hour ago"],
    ["2026-10-08T10:00:00.000Z", "2 hours ago"],
    ["2026-10-07T12:00:00.000Z", "yesterday"],
    ["2026-10-05T12:00:00.000Z", "3 days ago"],
  ])("formats %s as %s", (timestamp, expected) => {
    expect(formatRelativeTime(timestamp, now)).toBe(expected);
  });
});
