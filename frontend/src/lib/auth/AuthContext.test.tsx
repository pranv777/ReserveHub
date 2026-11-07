import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, renderHook, waitFor } from "@testing-library/react";
import type { ReactNode } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { AuthProvider, useAuth, useMe } from "./AuthContext";

const auth = {
  getSession: vi.fn(), onAuthStateChange: vi.fn(), signInWithPassword: vi.fn(), signUp: vi.fn(),
  signOut: vi.fn(), verifyOtp: vi.fn(), resend: vi.fn(),
};
const getMe = vi.fn();
const unsubscribe = vi.fn();
vi.mock("./supabase", () => ({
  supabase: {
    auth: {
      getSession: (...a: unknown[]) => auth.getSession(...a),
      onAuthStateChange: (...a: unknown[]) => auth.onAuthStateChange(...a),
      signInWithPassword: (...a: unknown[]) => auth.signInWithPassword(...a),
      signUp: (...a: unknown[]) => auth.signUp(...a),
      signOut: (...a: unknown[]) => auth.signOut(...a),
      verifyOtp: (...a: unknown[]) => auth.verifyOtp(...a),
      resend: (...a: unknown[]) => auth.resend(...a),
    },
  },
}));
vi.mock("../api/endpoints", () => ({ getMe: (...a: unknown[]) => getMe(...a) }));

const fakeSession = { user: { id: "u1", email: "m@example.com" }, access_token: "t" };

beforeEach(() => {
  Object.values(auth).forEach((m) => m.mockReset());
  getMe.mockReset();
  unsubscribe.mockReset();
  auth.onAuthStateChange.mockReturnValue({ data: { subscription: { unsubscribe } } });
  auth.signInWithPassword.mockResolvedValue({ error: null });
  auth.signUp.mockResolvedValue({ data: { session: null }, error: null });
  auth.verifyOtp.mockResolvedValue({ error: null });
  auth.resend.mockResolvedValue({ error: null });
  auth.signOut.mockResolvedValue({ error: null });
  getMe.mockResolvedValue({ id: "u1", email: "m@example.com", display_name: null, role: "admin" });
});

async function setup(session: unknown = null) {
  auth.getSession.mockResolvedValue({ data: { session } });
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const wrapper = ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={client}>
      <AuthProvider>{children}</AuthProvider>
    </QueryClientProvider>
  );
  const hook = renderHook(() => ({ auth: useAuth(), me: useMe() }), { wrapper });
  await waitFor(() => expect(hook.result.current.auth.loading).toBe(false));
  return { client, ...hook };
}

describe("AuthProvider", () => {
  it("loads the existing session", async () => {
    const { result } = await setup(fakeSession);
    expect(result.current.auth.session).toEqual(fakeSession);
  });

  it("starts signed out when there is no session", async () => {
    const { result } = await setup(null);
    expect(result.current.auth.session).toBeNull();
    expect(getMe).not.toHaveBeenCalled();
  });

  it("follows auth state changes and clears cached data on sign-out", async () => {
    const { result, client } = await setup(fakeSession);
    const clear = vi.spyOn(client, "clear");
    const onChange = auth.onAuthStateChange.mock.calls[0]?.[0] as (e: string, s: unknown) => void;
    act(() => onChange("SIGNED_OUT", null));
    expect(result.current.auth.session).toBeNull();
    expect(clear).toHaveBeenCalled();
  });

  it("unsubscribes when unmounted", async () => {
    const { unmount } = await setup();
    unmount();
    expect(unsubscribe).toHaveBeenCalled();
  });

  it("signs in with email and password", async () => {
    const { result } = await setup();
    await result.current.auth.signIn("a@example.com", "password123");
    expect(auth.signInWithPassword).toHaveBeenCalledWith({ email: "a@example.com", password: "password123" });
  });

  it("surfaces sign-in errors", async () => {
    auth.signInWithPassword.mockResolvedValue({ error: { message: "Invalid login credentials" } });
    const { result } = await setup();
    await expect(result.current.auth.signIn("a@example.com", "bad")).rejects.toThrow("Invalid login credentials");
  });

  it("signs up with a display name and reports that confirmation is needed", async () => {
    const { result } = await setup();
    const out = await result.current.auth.signUp("n@example.com", "password123", "Priya");
    expect(out).toEqual({ needsConfirmation: true });
    expect(auth.signUp).toHaveBeenCalledWith({
      email: "n@example.com", password: "password123", options: { data: { display_name: "Priya" } },
    });
  });

  it("sends no metadata without a display name and never sends a role", async () => {
    const { result } = await setup();
    await result.current.auth.signUp("n@example.com", "password123");
    const arg = auth.signUp.mock.calls[0]?.[0];
    expect(arg.options.data).toBeUndefined();
    expect(JSON.stringify(arg)).not.toContain("role");
  });

  it("reports no confirmation needed when sign-up returns a session", async () => {
    auth.signUp.mockResolvedValue({ data: { session: fakeSession }, error: null });
    const { result } = await setup();
    expect(await result.current.auth.signUp("n@example.com", "password123")).toEqual({ needsConfirmation: false });
  });

  it("surfaces sign-up errors", async () => {
    auth.signUp.mockResolvedValue({ data: { session: null }, error: { message: "Password too weak" } });
    const { result } = await setup();
    await expect(result.current.auth.signUp("n@example.com", "x")).rejects.toThrow("Password too weak");
  });

  it("verifies the sign-up code", async () => {
    const { result } = await setup();
    await result.current.auth.verifySignupOtp("n@example.com", "123456");
    expect(auth.verifyOtp).toHaveBeenCalledWith({ email: "n@example.com", token: "123456", type: "signup" });
  });

  it("surfaces an invalid or expired code", async () => {
    auth.verifyOtp.mockResolvedValue({ error: { message: "Token has expired or is invalid" } });
    const { result } = await setup();
    await expect(result.current.auth.verifySignupOtp("n@example.com", "000000")).rejects.toThrow("Token has expired or is invalid");
  });

  it("resends the sign-up code", async () => {
    const { result } = await setup();
    await result.current.auth.resendSignupOtp("n@example.com");
    expect(auth.resend).toHaveBeenCalledWith({ type: "signup", email: "n@example.com" });
  });

  it("surfaces resend errors", async () => {
    auth.resend.mockResolvedValue({ error: { message: "Email rate limit exceeded" } });
    const { result } = await setup();
    await expect(result.current.auth.resendSignupOtp("n@example.com")).rejects.toThrow("Email rate limit exceeded");
  });

  it("signs out", async () => {
    const { result } = await setup(fakeSession);
    await result.current.auth.signOut();
    expect(auth.signOut).toHaveBeenCalled();
  });
});

describe("useMe", () => {
  it("loads the profile (and role) from the API when signed in", async () => {
    const { result } = await setup(fakeSession);
    await waitFor(() => expect(result.current.me.me?.role).toBe("admin"));
  });
});

describe("useAuth", () => {
  it("throws when used outside AuthProvider", () => {
    const spy = vi.spyOn(console, "error").mockImplementation(() => undefined);
    expect(() => renderHook(() => useAuth())).toThrow("useAuth must be used inside AuthProvider");
    spy.mockRestore();
  });
});
