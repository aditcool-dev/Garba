// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { MessageStatus } from "../components/message-status";
import type { Message } from "../lib/supabase/types";
import { mergeMessage } from "../lib/message-receipts";

afterEach(cleanup);
const message = { id: "one", read_at: null, delivered_at: null } as Message;
describe("message receipt display", () => {
  it("does not downgrade receipts when a delayed save/poll response arrives", () => {
    const read = { ...message, delivered_at: "delivered", read_at: "read" };
    expect(mergeMessage(read, message)).toEqual(read);
    expect(mergeMessage(read, { ...message, chat_started_at: "different epoch" }).read_at).toBeNull();
  });
  it("distinguishes saved, received and read, suppressing blue for opt-out", () => {
    const { rerender } = render(<MessageStatus message={message} />);
    expect(screen.getByRole("img", { name: "Sent" })).toBeTruthy();
    rerender(<MessageStatus message={{ ...message, delivered_at: "now" }} />);
    expect(screen.getByRole("img", { name: "Delivered" })).toBeTruthy();
    rerender(<MessageStatus message={{ ...message, read_at: "now", delivered_at: "now" }} />);
    expect(screen.getByRole("img", { name: "Read" }).className).toContain("#34B7F1");
    rerender(<MessageStatus message={{ ...message, read_at: "now" }} readReceipts={false} />);
    expect(screen.getByRole("img", { name: "Delivered" }).className).toContain("#b6bccb");
  });
  it("has an accessible sending state and actionable failure", () => {
    const retry = vi.fn(), { rerender } = render(<MessageStatus message={{ ...message, local_status: "sending" }} />);
    expect(screen.getByRole("img", { name: "Sending" })).toBeTruthy();
    rerender(<MessageStatus message={{ ...message, local_status: "failed" }} onRetry={retry} />);
    fireEvent.click(screen.getByRole("button", { name: "Failed to send. Tap to retry" }));
    expect(retry).toHaveBeenCalledOnce();
  });
  it("keeps cyan and grey above AA text contrast across the outgoing gradient", () => {
    const rgb = (hex: string) => hex.match(/\w\w/g)!.map(v => parseInt(v, 16));
    const luminance = (values: number[]) => values.map(v => { const c = v / 255; return c <= .04045 ? c / 12.92 : ((c + .055) / 1.055) ** 2.4; }).reduce((sum, v, i) => sum + v * [.2126, .7152, .0722][i], 0);
    const a = rgb("55214b"), b = rgb("573027");
    for (let t = 0; t <= 100; t++) for (const tick of ["34B7F1", "b6bccb"]) {
      const background = luminance(a.map((v, i) => v + (b[i] - v) * t / 100));
      expect((luminance(rgb(tick)) + .05) / (background + .05)).toBeGreaterThanOrEqual(4.5);
    }
  });
});
