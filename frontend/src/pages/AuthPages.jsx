import { useState } from 'react';
import { Link, Navigate, useLocation, useNavigate } from 'react-router-dom';
import { api } from '../api.js';
import { homeFor, useAuth } from '../auth.jsx';
import { Icon, Notice } from '../components.jsx';
import '../original/login.css';
import '../original/register.css';

export function LoginPage() {
  const { user, login } = useAuth();
  const navigate = useNavigate(), location = useLocation();
  const [identifier, setIdentifier] = useState(''), [password, setPassword] = useState('');
  const [rememberMe, setRememberMe] = useState(false);
  const [showPassword, setShowPassword] = useState(false), [error, setError] = useState(''), [busy, setBusy] = useState(false);
  if (user) return <Navigate to={homeFor(user.role)} replace />;
  const submit = async event => {
    event.preventDefault(); setError(''); setBusy(true);
    try { const signedIn = await login(identifier, password, rememberMe); navigate(homeFor(signedIn.role), { replace: true }); }
    catch (e) { setError(e.message); } finally { setBusy(false); }
  };
  return <div className="original-login"><form className="original-form" onSubmit={submit}><div className="login-card">
    <div className="logo"><Link to="/"><img src="/original-assets/LOGO.png" alt="Caballeros TasteNet" /></Link></div><h2>Sign In</h2>
    <div className="input-box"><input aria-label="Username or email" autoComplete="username" value={identifier} onChange={e => setIdentifier(e.target.value)} placeholder="Username" required /></div>
    <div className="input-box password-box"><input aria-label="Password" type={showPassword ? 'text' : 'password'} autoComplete="current-password" value={password} onChange={e => setPassword(e.target.value)} placeholder="Password" required /><button className="password-toggle" type="button" aria-label={showPassword ? 'Hide password' : 'Show password'} onClick={() => setShowPassword(!showPassword)}><Icon name={showPassword ? 'eye' : 'eye-slash'} /></button></div>
    <Notice error={error} success={location.state?.created ? 'Registration successful. Sign in to your account.' : ''} />
    <div className="remember-forgot"><div className="remember-me"><input id="remember-login" type="checkbox" checked={rememberMe} onChange={e => setRememberMe(e.target.checked)} /><label htmlFor="remember-login">Remember me</label></div><button type="button" className="forgot-password text-link" onClick={() => setError('Password reset email is not configured yet. Contact your administrator for account recovery.')}>Forgot Password?</button></div>
    <button className="btn-login" disabled={busy}>{busy ? 'SIGNING IN…' : 'LOGIN'}</button><div className="extra-text"><Link className="create-account" to="/register">Create your account</Link></div><div className="or-text">or</div>
    <div className="social-login"><button type="button" className="google-btn" onClick={() => setError('Google sign in needs OAuth configuration. Please use your TasteNet username and password.')}><span className="google-icon-svg"><img src="/google.svg" alt="" /></span><span>Sign in with Google</span></button></div>
  </div></form></div>;
}

export function RegisterPage() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [form, setForm] = useState({ firstName: '', middleInitial: '', lastName: '', username: '', email: '', phone: '', gender: '', house: '', street: '', barangay: '', password: '', confirm: '' });
  const [showPassword, setShowPassword] = useState(false), [error, setError] = useState(''), [busy, setBusy] = useState(false);
  if (user) return <Navigate to={homeFor(user.role)} replace />;
  const change = event => setForm({ ...form, [event.target.name]: event.target.value });
  const input = (name, placeholder, props = {}) => <div className={`input-box ${['password', 'confirm'].includes(name) ? 'password-box' : ''}`}><input aria-label={placeholder} name={name} value={form[name]} onChange={change} placeholder={placeholder} required={name !== 'middleInitial'} {...props} />{['password', 'confirm'].includes(name) && <button type="button" className="password-toggle" aria-label={showPassword ? 'Hide password' : 'Show password'} onClick={() => setShowPassword(!showPassword)}><Icon name={showPassword ? 'eye' : 'eye-slash'} /></button>}</div>;
  const submit = async event => {
    event.preventDefault(); setError('');
    if (form.password !== form.confirm) { setError('Passwords do not match.'); return; }
    setBusy(true);
    try { await api('/api/auth/register', { method: 'POST', body: {
      username: form.username, email: form.email, password: form.password,
      fullName: [form.firstName, form.middleInitial, form.lastName].filter(Boolean).join(' '),
      phone: `+63${form.phone}`, gender: form.gender, address: `${form.house}, ${form.street}, ${form.barangay}, Dasmariñas, Cavite`
    } }); navigate('/login', { state: { created: true } }); }
    catch (e) { setError(e.message); } finally { setBusy(false); }
  };
  return <div className="original-register"><form className="original-form" onSubmit={submit}><div className="register-card">
    <div className="header-container"><Link to="/login" className="back-button" aria-label="Back to sign in"><Icon name="arrow-left" /></Link><div className="logo"><img src="/original-assets/LOGO.png" alt="TasteNet Logo" /></div></div><h2>Create Customer Account</h2>
    <div className="privacy-notice-card"><Icon name="shield-halved" /><span><strong>Data Privacy Notice:</strong> The information/data you provided will strictly be used to provide, maintain, and improve our services, and to communicate with you regarding your account.</span></div>
    <div className="form-container"><Notice error={error} /><div className="section-title">Personal Information</div><div className="triple-row">{input('firstName', 'First Name', { maxLength: 70 })}{input('middleInitial', 'Middle Initial', { maxLength: 2 })}{input('lastName', 'Last Name', { maxLength: 70 })}</div>
      <div className="triple-row">{input('username', 'Username', { minLength: 3, maxLength: 80 })}{input('email', 'Email', { type: 'email', autoComplete: 'email' })}<div className="input-box mobile-input"><span className="mobile-prefix">+63</span><input name="phone" aria-label="Mobile number" placeholder="9XXXXXXXXX" value={form.phone} onChange={change} maxLength={10} pattern="9[0-9]{9}" required inputMode="tel" /></div></div>
      <div className="gender-container"><span className="gender-label">Gender</span><span className="gender-category-list">{['Male', 'Female'].map(gender => <label key={gender}><input type="radio" name="gender" value={gender} checked={form.gender === gender} onChange={change} required /> {gender}</label>)}</span></div>
      <div className="section-title">Address Information</div><div className="double-row">{input('house', 'House/Building No.')}{input('street', 'Street')}</div><div className="double-row">{input('barangay', 'Barangay')}<div className="input-box"><input aria-label="District" value="Dasmariñas" readOnly /></div></div><div className="district-info"><Icon name="circle-info" /> Service area : Dasmariñas, Cavite</div>
      <div className="section-title">Security Information</div><div className="double-row">{input('password', 'Password', { type: showPassword ? 'text' : 'password', minLength: 12, autoComplete: 'new-password' })}{input('confirm', 'Confirm Password', { type: showPassword ? 'text' : 'password', minLength: 12, autoComplete: 'new-password' })}</div><p className="password-hint">Use at least 12 characters.</p>
    </div><div className="button-group"><button className="btn-register" disabled={busy}>{busy ? 'REGISTERING…' : 'REGISTER'}</button></div><div className="extra-text">Already have an account? <Link className="sign-in-link" to="/login">Sign In</Link></div>
  </div></form></div>;
}
