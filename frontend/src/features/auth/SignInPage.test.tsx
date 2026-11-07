import { act, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { renderAt } from "../../test/utils";
import { SignInPage } from "./SignInPage";

const state = { session: null as unknown };
const signIn = vi.fn();
const signUp = vi.fn();
const verifySignupOtp = vi.fn();
const resendSignupOtp = vi.fn();
vi.mock("../../lib/auth/AuthContext", () => ({
  useAuth: () => ({
    session: state.session, loading: false, signIn, signUp, signOut: vi.fn(), verifySignupOtp, resendSignupOtp,
  }),
}));

type User = ReturnType<typeof userEvent.setup>;

beforeEach(() => {
  state.session = null;
  [signIn, signUp, verifySignupOtp, resendSignupOtp].forEach((m) => m.mockReset());
});
afterEach(() => vi.useRealTimers());

async function fillSignUp(user: User, over: { confirm?: string; name?: string } = {}) {
  await user.click(screen.getByRole("button", { name: "Create an account" }));
  if (over.name) await user.type(screen.getByLabelText("Display name (optional)"), over.name);
  await user.type(screen.getByLabelText("Email"), "new@example.com");
  await user.type(screen.getByLabelText("Password"), "password123");
  await user.type(screen.getByLabelText("Confirm password"), over.confirm ?? "password123");
  await user.click(screen.getByRole("button", { name: "Sign up" }));
}

async function goToOtp(user: User) {
  signUp.mockResolvedValue({ needsConfirmation: true });
  renderAt(<SignInPage />);
  await fillSignUp(user);
  await screen.findByRole("heading", { name: "Verify your email" });
}

async function waitOutCooldown() {
  for (let i = 0; i < 61; i++) {
    await act(async () => { vi.advanceTimersByTime(1000); });
  }
}

describe("SignInPage: sign in", () => {
  it("shows field validation errors and does not call the provider", async () => {
    renderAt(<SignInPage />);
    await userEvent.type(screen.getByLabelText("Email"), "not-an-email");
    await userEvent.type(screen.getByLabelText("Password"), "short");
    await userEvent.click(screen.getByRole("button", { name: "Sign in" }));
    expect(await screen.findByText("Enter a valid email address")).toBeInTheDocument();
    expect(screen.getByText("Password must be at least 8 characters")).toBeInTheDocument();
    expect(signIn).not.toHaveBeenCalled();
  });

  it("signs in with valid credentials", async () => {
    signIn.mockResolvedValue(undefined);
    renderAt(<SignInPage />);
    await userEvent.type(screen.getByLabelText("Email"), "a@example.com");
    await userEvent.type(screen.getByLabelText("Password"), "password123");
    await userEvent.click(screen.getByRole("button", { name: "Sign in" }));
    await waitFor(() => expect(signIn).toHaveBeenCalledWith("a@example.com", "password123"));
  });

  it("surfaces authentication errors", async () => {
    signIn.mockRejectedValue(new Error("Invalid login credentials"));
    renderAt(<SignInPage />);
    await userEvent.type(screen.getByLabelText("Email"), "a@example.com");
    await userEvent.type(screen.getByLabelText("Password"), "password123");
    await userEvent.click(screen.getByRole("button", { name: "Sign in" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("Invalid login credentials");
  });

  it("toggles password visibility", async () => {
    renderAt(<SignInPage />);
    const password = screen.getByLabelText("Password");
    expect(password).toHaveAttribute("type", "password");
    await userEvent.click(screen.getByRole("button", { name: "Show" }));
    expect(password).toHaveAttribute("type", "text");
    await userEvent.click(screen.getByRole("button", { name: "Hide" }));
    expect(password).toHaveAttribute("type", "password");
  });

  it("redirects signed-in users away from the page", () => {
    state.session = { user: { id: "u1" } };
    render(
      <MemoryRouter initialEntries={["/signin"]}>
        <Routes>
          <Route path="/signin" element={<SignInPage />} />
          <Route path="/" element={<div>home page</div>} />
        </Routes>
      </MemoryRouter>,
    );
    expect(screen.getByText("home page")).toBeInTheDocument();
  });

  it("opens the sign-up form when the link has ?mode=signup", () => {
    render(
      <MemoryRouter initialEntries={["/signin?mode=signup"]}>
        <Routes>
          <Route path="/signin" element={<SignInPage />} />
        </Routes>
      </MemoryRouter>,
    );
    expect(screen.getByRole("heading", { name: "Create your account" })).toBeInTheDocument();
  });
});

describe("SignInPage: sign up", () => {
  it("rejects mismatched passwords without calling the provider", async () => {
    renderAt(<SignInPage />);
    await fillSignUp(userEvent.setup(), { confirm: "different123" });
    expect(await screen.findByText("Passwords do not match")).toBeInTheDocument();
    expect(signUp).not.toHaveBeenCalled();
  });

  it("toggles visibility for both password fields", async () => {
    renderAt(<SignInPage />);
    await userEvent.click(screen.getByRole("button", { name: "Create an account" }));
    await userEvent.click(screen.getByRole("button", { name: "Show" }));
    expect(screen.getByLabelText("Password")).toHaveAttribute("type", "text");
    expect(screen.getByLabelText("Confirm password")).toHaveAttribute("type", "text");
  });

  it("sends the display name and moves to the OTP step without sending any role", async () => {
    signUp.mockResolvedValue({ needsConfirmation: true });
    renderAt(<SignInPage />);
    await fillSignUp(userEvent.setup(), { name: "Priya" });
    await waitFor(() => expect(signUp).toHaveBeenCalledWith("new@example.com", "password123", "Priya"));
    expect(await screen.findByRole("heading", { name: "Verify your email" })).toBeInTheDocument();
    expect(screen.getByText("new@example.com")).toBeInTheDocument();
  });

  it("does not show the OTP step when no confirmation is needed", async () => {
    signUp.mockResolvedValue({ needsConfirmation: false });
    renderAt(<SignInPage />);
    await fillSignUp(userEvent.setup());
    await waitFor(() => expect(signUp).toHaveBeenCalled());
    expect(screen.queryByRole("heading", { name: "Verify your email" })).not.toBeInTheDocument();
  });

  it("shows sign-up errors", async () => {
    signUp.mockRejectedValue(new Error("Password is too weak"));
    renderAt(<SignInPage />);
    await fillSignUp(userEvent.setup());
    expect(await screen.findByRole("alert")).toHaveTextContent("Password is too weak");
  });
});

describe("SignInPage: email verification step", () => {
  it("only accepts digits in the code field", async () => {
    const user = userEvent.setup();
    await goToOtp(user);
    const code = screen.getByLabelText("Verification code");
    await user.type(code, "12ab34");
    expect(code).toHaveValue("1234");
  });

  it("asks for the full code before calling the provider", async () => {
    const user = userEvent.setup();
    await goToOtp(user);
    await user.type(screen.getByLabelText("Verification code"), "123");
    await user.click(screen.getByRole("button", { name: "Verify and continue" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("Enter the 6-digit code.");
    expect(verifySignupOtp).not.toHaveBeenCalled();
  });

  it("verifies a complete code", async () => {
    verifySignupOtp.mockResolvedValue(undefined);
    const user = userEvent.setup();
    await goToOtp(user);
    await user.type(screen.getByLabelText("Verification code"), "123456");
    await user.click(screen.getByRole("button", { name: "Verify and continue" }));
    await waitFor(() => expect(verifySignupOtp).toHaveBeenCalledWith("new@example.com", "123456"));
  });

  it("shows an invalid or expired code error", async () => {
    verifySignupOtp.mockRejectedValue(new Error("Token has expired or is invalid"));
    const user = userEvent.setup();
    await goToOtp(user);
    await user.type(screen.getByLabelText("Verification code"), "000000");
    await user.click(screen.getByRole("button", { name: "Verify and continue" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("Token has expired or is invalid");
  });

  it("returns to the form with 'Use a different email'", async () => {
    const user = userEvent.setup();
    await goToOtp(user);
    await user.click(screen.getByRole("button", { name: "Use a different email" }));
    expect(screen.getByRole("heading", { name: "Create your account" })).toBeInTheDocument();
  });

  it("keeps Resend disabled during the cooldown, then resends the code", async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    resendSignupOtp.mockResolvedValue(undefined);
    await goToOtp(user);
    expect(screen.getByRole("button", { name: /Resend code in \d+s/ })).toBeDisabled();
    await waitOutCooldown();
    const resend = screen.getByRole("button", { name: "Resend code" });
    expect(resend).toBeEnabled();
    await user.click(resend);
    expect(resendSignupOtp).toHaveBeenCalledWith("new@example.com");
    expect(await screen.findByRole("status")).toHaveTextContent("A new code has been sent.");
    expect(screen.getByRole("button", { name: /Resend code in \d+s/ })).toBeDisabled();
  });

  it("shows an error when resending fails", async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    resendSignupOtp.mockRejectedValue(new Error("Email rate limit exceeded"));
    await goToOtp(user);
    await waitOutCooldown();
    await user.click(screen.getByRole("button", { name: "Resend code" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("Email rate limit exceeded");
  });
});
