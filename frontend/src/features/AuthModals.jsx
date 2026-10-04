import { useEffect, useState } from "react";
import { Link, Navigate, useLocation, useNavigate } from "react-router-dom";
import { api } from "../api.js";
import { homeFor, useAuth } from "../auth.jsx";
import { Icon, Modal, Notice } from "../components.jsx";
import { PasswordInput } from "./PasswordInput.jsx";
import {
  AddressFields,
  PhoneInput,
  passwordHelp,
  passwordPattern,
  useBarangays,
} from "./AccountFields.jsx";
import {
  ForgotPasswordDialog,
  useAuthCapabilities,
  VerificationDialog,
} from "./AccountRecovery.jsx";
import "../original/login.css";
import "../original/register.css";
import "./account-experience.css";
import "./auth-modals.css";

export function LoginPage() {
  const { user, login } = useAuth(),
    capabilities = useAuthCapabilities(),
    navigate = useNavigate(),
    location = useLocation();
  const [identifier, setIdentifier] = useState(""),
    [password, setPassword] = useState(""),
    [rememberMe, setRememberMe] = useState(false),
    [recovering, setRecovering] = useState(false),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false);
  if (user) return <Navigate to={homeFor(user.role)} replace />;
  if (recovering)
    return <ForgotPasswordDialog onClose={() => setRecovering(false)} />;
  return (
    <Modal title="Sign In" variant="auth-login" onClose={() => navigate("/")}>
      <div className="original-login">
        <form
          className="original-form"
          onSubmit={async (event) => {
            event.preventDefault();
            setError("");
            setBusy(true);
            try {
              const account = await login(identifier, password, rememberMe);
              navigate(homeFor(account.role), { replace: true });
            } catch (e) {
              setError(e.message);
            } finally {
              setBusy(false);
            }
          }}
        >
          <div className="login-card">
            <div className="logo">
              <img src="/original-assets/LOGO.png" alt="Caballeros TasteNet" />
            </div>
            <span className="auth-eyebrow">WELCOME BACK TO CABALLEROS</span>
            <h2>Sign In</h2>
            <p className="auth-intro">
              Good food and your TasteNet account, all in one place.
            </p>
            <div className="input-box">
              <input
                aria-label="Username or email"
                autoComplete="username"
                value={identifier}
                onChange={(e) => setIdentifier(e.target.value)}
                placeholder="Username or email"
                required
              />
            </div>
            <div className="input-box password-box">
              <PasswordInput
                aria-label="Password"
                autoComplete="current-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Password"
                required
              />
            </div>
            <Notice
              error={
                error ||
                (location.search.includes("error=google")
                  ? "Google sign-in could not be completed. Please try again."
                  : "")
              }
            />
            <div className="remember-forgot">
              <label className="remember-me">
                <input
                  type="checkbox"
                  checked={rememberMe}
                  onChange={(e) => setRememberMe(e.target.checked)}
                />
                Remember me
              </label>
              <button
                type="button"
                className="forgot-password text-link"
                disabled={busy}
                onClick={() => setRecovering(true)}
              >
                Forgot Password?
              </button>
            </div>
            <button className="btn-login" disabled={busy}>
              {busy ? "SIGNING IN…" : "LOGIN"}
            </button>
            <p className="auth-role-note">
              Your account automatically opens your customer, rider, admin, or
              store owner portal.
            </p>
            <div className="auth-divider">
              <span>or continue with</span>
            </div>
            <div className="social-login">
              <button
                type="button"
                className="google-btn"
                onClick={() =>
                  capabilities.google
                    ? window.location.assign("/api/auth/google")
                    : setError(
                        "Google sign-in will be available once the administrator finishes setup.",
                      )
                }
              >
                <img src="/google.svg" alt="" />
                <span>Google</span>
              </button>
            </div>
            <div className="extra-text">
              New to Caballeros?{" "}
              <Link className="create-account" to="/register">
                Create your account
              </Link>
            </div>
          </div>
        </form>
      </div>
    </Modal>
  );
}

export function RegisterPage() {
  const { user } = useAuth(),
    capabilities = useAuthCapabilities(),
    navigate = useNavigate(),
    { areas, error: areaError } = useBarangays();
  const [form, setForm] = useState({
    firstName: "",
    lastName: "",
    username: "",
    email: "",
    phone: "",
    addressDetails: { houseNumber: "", street: "", barangay: "" },
    password: "",
    confirm: "",
  });
  const [error, setError] = useState(""),
    [busy, setBusy] = useState(false),
    [verifyEmail, setVerifyEmail] = useState(false),
    [created, setCreated] = useState(false),
    [usernameStatus, setUsernameStatus] = useState("");
  const change = (key, value) =>
    setForm((previous) => ({ ...previous, [key]: value }));
  useEffect(() => {
    if (form.username.trim().length < 3) {
      setUsernameStatus("");
      return;
    }
    const controller = new AbortController();
    setUsernameStatus("checking");
    const timer = setTimeout(
      () =>
        api(
          `/api/auth/username-availability?username=${encodeURIComponent(form.username.trim())}`,
          { signal: controller.signal },
        )
          .then((data) =>
            setUsernameStatus(
              data.available === false
                ? "taken"
                : data.available
                  ? "available"
                  : "",
            ),
          )
          .catch((error) => {
            if (error.name !== "AbortError") setUsernameStatus("");
          }),
      350,
    );
    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [form.username]);
  if (user) return <Navigate to={homeFor(user.role)} replace />;
  const submit = async (event, resend = false) => {
    event.preventDefault();
    setError("");
    if (form.password !== form.confirm) {
      setError("Passwords do not match.");
      return;
    }
    if (usernameStatus === "taken") {
      setError("That username is already taken. Choose another.");
      return;
    }
    setBusy(true);
    try {
      await api(
        capabilities.registrationOtp
          ? "/api/auth/register/request-otp"
          : "/api/auth/register",
        {
          method: "POST",
          body: {
            username: form.username.trim(),
            email: form.email,
            password: form.password,
            fullName: `${form.firstName.trim()} ${form.lastName.trim()}`,
            phone: `+63${form.phone}`,
            addressDetails: form.addressDetails,
          },
        },
      );
      if (capabilities.registrationOtp) setVerifyEmail(true);
      else setCreated(true);
    } catch (e) {
      if (resend) throw e;
      setError(e.message);
    } finally {
      setBusy(false);
    }
  };
  const input = (key, label, props = {}) => (
    <label>
      {label}
      <input
        aria-label={label}
        value={form[key]}
        onChange={(e) => change(key, e.target.value)}
        required
        {...props}
      />
    </label>
  );
  return (
    <Modal
      title="Create Customer Account"
      variant="auth-register"
      onClose={() => navigate("/")}
    >
      <div className="original-register">
        <form className="original-form" onSubmit={submit}>
          <div className="register-card">
            <div className="auth-register-heading">
              <Link
                to="/login"
                className="back-button"
                aria-label="Back to sign in"
              >
                <Icon name="arrow-left" />
              </Link>
              <img src="/original-assets/LOGO.png" alt="Caballeros TasteNet" />
              <div>
                <span className="auth-eyebrow">A SEAT AT OUR TABLE</span>
                <h2>Create Customer Account</h2>
                <p>Your favorites are a few details away.</p>
              </div>
            </div>
            <p className="auth-privacy">
              <Icon name="shield-halved" /> Your details help us manage your
              account and deliver your orders.
            </p>
            <div className="auth-section-heading">
              <span>01</span>
              <h3>Personal information</h3>
            </div>
            <div className="account-fields-grid">
              {input("firstName", "First Name", {
                maxLength: 70,
                autoComplete: "given-name",
              })}
              {input("lastName", "Last Name", {
                maxLength: 70,
                autoComplete: "family-name",
              })}
              <label>
                Username
                <input
                  aria-label="Username"
                  autoComplete="username"
                  minLength={3}
                  maxLength={80}
                  required
                  value={form.username}
                  onChange={(e) => change("username", e.target.value)}
                  aria-describedby="username-status"
                />
                <small
                  id="username-status"
                  className={`username-status ${usernameStatus}`}
                  aria-live="polite"
                >
                  {usernameStatus === "taken"
                    ? "Already taken. Try another username."
                    : usernameStatus === "available"
                      ? "This username is available."
                      : usernameStatus === "checking"
                        ? "Checking username…"
                        : "Choose a unique username."}
                </small>
              </label>
              {input("email", "Email", {
                type: "email",
                autoComplete: "email",
              })}
              <label>
                Mobile number
                <PhoneInput
                  value={form.phone}
                  onChange={(value) => change("phone", value)}
                />
              </label>
            </div>
            <div className="auth-section-heading">
              <span>02</span>
              <h3>Address information</h3>
            </div>
            <AddressFields
              value={form.addressDetails}
              onChange={(value) => change("addressDetails", value)}
              areas={areas}
            />
            <div className="auth-section-heading">
              <span>03</span>
              <h3>Security information</h3>
            </div>
            <div className="account-fields-grid">
              <label>
                Password
                <PasswordInput
                  aria-label="Password"
                  autoComplete="new-password"
                  minLength={12}
                  pattern={passwordPattern}
                  title={passwordHelp}
                  value={form.password}
                  onChange={(e) => change("password", e.target.value)}
                  required
                />
              </label>
              <label>
                Confirm Password
                <PasswordInput
                  aria-label="Confirm Password"
                  visibilityLabel="confirm password"
                  autoComplete="new-password"
                  value={form.confirm}
                  onChange={(e) => change("confirm", e.target.value)}
                  required
                />
              </label>
            </div>
            <p className="auth-password-help">{passwordHelp}</p>
            <Notice error={error || areaError} />
            <button
              className="btn-register"
              disabled={
                busy ||
                usernameStatus === "taken" ||
                usernameStatus === "checking" ||
                !areas.length
              }
            >
              {busy ? "REGISTERING…" : "REGISTER"}
            </button>
            <div className="extra-text">
              Already have an account?{" "}
              <Link className="sign-in-link" to="/login">
                Sign In
              </Link>
            </div>
          </div>
        </form>
      </div>
      {verifyEmail && (
        <VerificationDialog
          email={form.email.toLowerCase()}
          onClose={() => setVerifyEmail(false)}
          onResend={() => submit({ preventDefault() {} }, true)}
          onVerified={() => {
            setVerifyEmail(false);
            setCreated(true);
          }}
        />
      )}
      {created && (
        <Modal title="Account Created" onClose={() => navigate("/login")}>
          <div className="registration-success">
            <span>
              <Icon name="circle-check" />
            </span>
            <h3>Welcome to Caballeros!</h3>
            <p>You have successfully created your account.</p>
            <button
              className="migration-button primary"
              onClick={() => navigate("/login")}
            >
              Log In
            </button>
          </div>
        </Modal>
      )}
    </Modal>
  );
}
