import { afterEach, describe, expect, it, vi } from "vitest";
import { ApiError, api, setTokenProvider } from "./client";

const json = (status: number, body: unknown) =>
  Promise.resolve(new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } }));

afterEach(() => {
  vi.unstubAllGlobals();
  setTokenProvider(async () => null);
});

describe("api client", () => {
  it("sends the bearer token and parses JSON", async () => {
    setTokenProvider(async () => "tok123");
    const fetchMock = vi.fn().mockReturnValue(json(200, { ok: true }));
    vi.stubGlobal("fetch", fetchMock);
    await expect(api("/me")).resolves.toEqual({ ok: true });
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toContain("/api/v1/me");
    expect((init.headers as Record<string, string>).Authorization).toBe("Bearer tok123");
  });

  it("maps the documented error envelope to ApiError", async () => {
    vi.stubGlobal("fetch", vi.fn().mockReturnValue(
      json(409, { error: { code: "slot_unavailable", message: "This slot is no longer available.", request_id: "r-1" } }),
    ));
    const err = await api("/bookings", { method: "POST", body: {} }).catch((e: unknown) => e);
    expect(err).toBeInstanceOf(ApiError);
    expect(err).toMatchObject({ status: 409, code: "slot_unavailable", requestId: "r-1", message: "This slot is no longer available." });
  });

  it("handles unknown error bodies and 204", async () => {
    vi.stubGlobal("fetch", vi.fn().mockReturnValueOnce(Promise.resolve(new Response("<html>", { status: 502 }))));
    await expect(api("/x")).rejects.toMatchObject({ status: 502, code: "unknown_error" });
    vi.stubGlobal("fetch", vi.fn().mockReturnValue(Promise.resolve(new Response(null, { status: 204 }))));
    await expect(api("/x", { method: "DELETE" })).resolves.toBeUndefined();
  });

  it("reports network failures with a friendly error", async () => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new TypeError("Failed to fetch")));
    await expect(api("/x")).rejects.toMatchObject({ status: 0, code: "network_error" });
  });

  it("drops empty query params", async () => {
    const fetchMock = vi.fn().mockReturnValue(json(200, {}));
    vi.stubGlobal("fetch", fetchMock);
    await api("/slots", { query: { page: 2, location: "", category: undefined, available_only: true } });
    expect((fetchMock.mock.calls[0] as [string])[0]).toMatch(/\/slots\?page=2&available_only=true$/);
  });
});
