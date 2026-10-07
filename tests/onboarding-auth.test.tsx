// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import Onboarding from "../app/onboarding/page";

const mocks = vi.hoisted(() => ({ save: vi.fn(), refresh: vi.fn(), replace: vi.fn(), getUser: vi.fn() }));
const account = { id: "00000000-0000-4000-8000-000000000001", email: "student.cs24@bmsce.ac.in", email_confirmed_at: "2026-10-07T12:00:00Z", app_metadata: {} };
vi.mock("next/navigation", () => ({ useRouter: () => ({ replace: mocks.replace }) }));
vi.mock("../components/app-shell", () => ({ AppShell: ({ children }: { children: React.ReactNode }) => children }));
vi.mock("../lib/supabase/auth-context", () => ({ useAuth: () => ({ user: account, profile: { first_name: "Student", age: 18, looking_for: [], available_nights: [] }, refreshProfile: mocks.refresh }) }));
vi.mock("../lib/supabase/client", () => ({ db: { upsertProfile: mocks.save }, getSupabaseClient: () => ({ auth: { getUser: mocks.getUser } }) }));
afterEach(() => { cleanup(); vi.resetAllMocks(); });
const next = () => fireEvent.click(screen.getByRole("button", { name: /Continue/ }));
const ageStep = () => { render(<Onboarding />); next(); next(); return screen.getByLabelText("Your age") as HTMLInputElement; };

describe("real onboarding controls and authenticated submission", () => {
  it("starts empty even with the trigger's scaffold age, preserves 2 → 22 → empty and uses the numeric keyboard", () => {
    const input = ageStep();
    expect(input.value).toBe("");
    expect(input.getAttribute("inputmode")).toBe("numeric");
    fireEvent.change(input, { target: { value: "2" } }); expect(input.value).toBe("2");
    fireEvent.change(input, { target: { value: "22" } }); expect(input.value).toBe("22");
    fireEvent.change(input, { target: { value: "" } }); expect(input.value).toBe("");
    fireEvent.change(input, { target: { value: "e-1.5" } }); expect(input.value).toBe("");
    next(); expect(screen.getByRole("alert").textContent).toBe("Please enter your age.");
    fireEvent.change(input, { target: { value: "17" } }); next();
    expect(screen.getByRole("alert").textContent).toBe("You must be 18 or older to use GarbaMate.");
    expect(mocks.save).not.toHaveBeenCalled();
  });
  it.each(["18", "19", "20", "21", "22"])("allows age %s without a forced prefix", value => {
    const input = ageStep(); fireEvent.change(input, { target: { value } }); expect(input.value).toBe(value); next();
    expect(screen.getByLabelText("Your BMSCE branch")).toBeTruthy();
  });
  it("saves numeric 22 under the verified Supabase UUID before navigating", async () => {
    mocks.getUser.mockResolvedValue({ data: { user: account }, error: null });
    mocks.save.mockResolvedValue({ id: account.id, onboarding_complete: true });
    mocks.refresh.mockResolvedValue(undefined);
    const input = ageStep(); fireEvent.change(input, { target: { value: "22" } });
    for (let i = 3; i < 10; i++) next();
    fireEvent.click(screen.getByRole("button", { name: "Start discovering →" }));
    await waitFor(() => expect(mocks.replace).toHaveBeenCalledWith("/discover"));
    expect(mocks.save).toHaveBeenCalledWith(expect.objectContaining({ id: account.id, age: 22, onboarding_complete: true }));
    expect(mocks.refresh).toHaveBeenCalledOnce();
  });
  it("rejects an expired session without a fake/local user and permits retry after save failure", async () => {
    localStorage.setItem("garbamate_auth_session", JSON.stringify({ id: "student-fake" }));
    mocks.getUser.mockResolvedValue({ data: { user: null }, error: null });
    const input = ageStep(); fireEvent.change(input, { target: { value: "22" } });
    for (let i = 3; i < 10; i++) next();
    fireEvent.click(screen.getByRole("button", { name: "Start discovering →" }));
    await screen.findByRole("alert");
    expect(mocks.save).not.toHaveBeenCalled(); expect(mocks.replace).not.toHaveBeenCalled();
    mocks.getUser.mockResolvedValue({ data: { user: account }, error: null });
    mocks.save.mockRejectedValue(new Error("Database temporarily unavailable"));
    fireEvent.click(screen.getByRole("button", { name: "Start discovering →" }));
    await waitFor(() => expect(screen.getByRole("alert").textContent).toBe("Database temporarily unavailable"));
    expect((screen.getByRole("button", { name: "Start discovering →" }) as HTMLButtonElement).disabled).toBe(false);
  });
});
