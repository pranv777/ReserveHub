import { zodResolver } from "@hookform/resolvers/zod";
import { useEffect, useState, type FormEvent } from "react";
import { useForm } from "react-hook-form";
import { Navigate, useNavigate, useSearchParams } from "react-router-dom";
import { z } from "zod";
import { useAuth } from "../../lib/auth/AuthContext";

const OTP_LENGTH = 6; // keep in sync with otp_length in supabase/config.toml
const RESEND_SECONDS = 60;

const schema = z.object({
  email: z.string().trim().min(1, "Email is required").email("Enter a valid email address"),
  password: z.string().min(8, "Password must be at least 8 characters"),
  confirmPassword: z.string().optional(),
  displayName: z.string().max(120, "Name is too long").optional(),
});
type FormValues = z.infer<typeof schema>;

function VerifyOtpStep({ email, onBack }: { email: string; onBack: () => void }) {
  const { verifySignupOtp, resendSignupOtp } = useAuth();
  const [code, setCode] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [cooldown, setCooldown] = useState(RESEND_SECONDS);

  useEffect(() => {
    if (cooldown <= 0) return;
    const t = setTimeout(() => setCooldown((s) => s - 1), 1000);
    return () => clearTimeout(t);
  }, [cooldown]);

  const verify = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    setNotice(null);
    if (code.length !== OTP_LENGTH) {
      setError(`Enter the ${OTP_LENGTH}-digit code.`);
      return;
    }
    setBusy(true);
    try {
      await verifySignupOtp(email, code); // success creates a session; the page then redirects
    } catch (err) {
      setError(err instanceof Error ? err.message : "Verification failed");
    } finally {
      setBusy(false);
    }
  };

  const resend = async () => {
    setError(null);
    setNotice(null);
    try {
      await resendSignupOtp(email);
      setNotice("A new code has been sent.");
      setCooldown(RESEND_SECONDS);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not resend the code");
    }
  };

  return (
    <div className="mx-auto mt-16 max-w-sm px-4">
      <h1 className="text-2xl font-bold">Verify your email</h1>
      <p className="mt-2 text-sm">We sent a {OTP_LENGTH}-digit code to <strong>{email}</strong>.</p>
      <form onSubmit={verify} noValidate className="card mt-6 space-y-4">
        {error && <p role="alert" className="rounded bg-red-50 p-2 text-sm text-red-800">{error}</p>}
        {notice && <p role="status" className="rounded bg-green-50 p-2 text-sm text-green-800">{notice}</p>}
        <div>
          <label className="label" htmlFor="otp">Verification code</label>
          <input id="otp" className="input tracking-widest" inputMode="numeric"
            autoComplete="one-time-code" maxLength={OTP_LENGTH} value={code}
            onChange={(e) => setCode(e.target.value.replace(/\D/g, ""))} />
        </div>
        <button type="submit" className="btn btn-primary w-full" disabled={busy}>
          {busy ? "Verifying…" : "Verify and continue"}
        </button>
      </form>
      <div className="mt-4 flex justify-between text-sm">
        <button type="button" className="text-indigo-700 underline" onClick={onBack}>Use a different email</button>
        <button type="button" className="text-indigo-700 underline disabled:text-gray-400 disabled:no-underline"
          disabled={cooldown > 0} onClick={() => void resend()}>
          {cooldown > 0 ? `Resend code in ${cooldown}s` : "Resend code"}
        </button>
      </div>
    </div>
  );
}

export function SignInPage() {
  const { session, signIn, signUp } = useAuth();
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const [mode, setMode] = useState<"signin" | "signup">(params.get("mode") === "signup" ? "signup" : "signin");
  const [step, setStep] = useState<"form" | "otp">("form");
  const [pendingEmail, setPendingEmail] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [authError, setAuthError] = useState<string | null>(null);
  const {
    register, handleSubmit, setError, formState: { errors, isSubmitting },
  } = useForm<FormValues>({ resolver: zodResolver(schema) });

  if (session) return <Navigate to="/" replace />;

  if (step === "otp") {
    return <VerifyOtpStep email={pendingEmail} onBack={() => setStep("form")} />;
  }

  const onSubmit = async (values: FormValues) => {
    setAuthError(null);
    try {
      if (mode === "signin") {
        await signIn(values.email, values.password);
        navigate("/");
      } else {
        if (values.password !== (values.confirmPassword ?? "")) {
          setError("confirmPassword", { message: "Passwords do not match" });
          return;
        }
        const { needsConfirmation } = await signUp(values.email, values.password, values.displayName || undefined);
        if (needsConfirmation) {
          setPendingEmail(values.email);
          setStep("otp");
        } else {
          navigate("/");
        }
      }
    } catch (e) {
      setAuthError(e instanceof Error ? e.message : "Authentication failed");
    }
  };

  const toggle = (
    <button type="button" className="absolute inset-y-0 right-2 text-xs font-medium text-indigo-700"
      aria-pressed={showPassword} onClick={() => setShowPassword((s) => !s)}>
      {showPassword ? "Hide" : "Show"}
    </button>
  );

  return (
    <div className="mx-auto mt-16 max-w-sm px-4">
      <h1 className="text-2xl font-bold">{mode === "signin" ? "Sign in to ReserveHub" : "Create your account"}</h1>
      <form onSubmit={handleSubmit(onSubmit)} noValidate className="card mt-6 space-y-4">
        {authError && <p role="alert" className="rounded bg-red-50 p-2 text-sm text-red-800">{authError}</p>}
        {mode === "signup" && (
          <div>
            <label className="label" htmlFor="displayName">Display name (optional)</label>
            <input id="displayName" className="input" autoComplete="name" {...register("displayName")} />
            {errors.displayName && <p className="field-error">{errors.displayName.message}</p>}
          </div>
        )}
        <div>
          <label className="label" htmlFor="email">Email</label>
          <input id="email" type="email" className="input" autoComplete="email"
            aria-invalid={!!errors.email} {...register("email")} />
          {errors.email && <p className="field-error">{errors.email.message}</p>}
        </div>
        <div>
          <label className="label" htmlFor="password">Password</label>
          <div className="relative">
            <input id="password" type={showPassword ? "text" : "password"} className="input pr-14"
              autoComplete={mode === "signin" ? "current-password" : "new-password"}
              aria-invalid={!!errors.password} {...register("password")} />
            {toggle}
          </div>
          {errors.password && <p className="field-error">{errors.password.message}</p>}
        </div>
        {mode === "signup" && (
          <div>
            <label className="label" htmlFor="confirmPassword">Confirm password</label>
            <input id="confirmPassword" type={showPassword ? "text" : "password"} className="input"
              autoComplete="new-password" aria-invalid={!!errors.confirmPassword}
              {...register("confirmPassword")} />
            {errors.confirmPassword && <p className="field-error">{errors.confirmPassword.message}</p>}
          </div>
        )}
        <button type="submit" className="btn btn-primary w-full" disabled={isSubmitting}>
          {isSubmitting ? "Please wait…" : mode === "signin" ? "Sign in" : "Sign up"}
        </button>
      </form>
      <p className="mt-4 text-center text-sm">
        {mode === "signin" ? "New here?" : "Already registered?"}{" "}
        <button type="button" className="font-medium text-indigo-700 underline"
          onClick={() => { setMode(mode === "signin" ? "signup" : "signin"); setAuthError(null); setShowPassword(false); }}>
          {mode === "signin" ? "Create an account" : "Sign in"}
        </button>
      </p>
    </div>
  );
}
