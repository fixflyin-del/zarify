import React, { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { updateProfile } from 'firebase/auth';
import {
  CheckCircle2,
  ExternalLink,
  Heart,
  KeyRound,
  LogOut,
  Mail,
  MessageCircle,
  Package,
  Shield,
  Smartphone,
  User as UserIcon,
} from 'lucide-react';
import { useStore, type WhatsAppOtpRequestResult } from '../context/StoreContext';
import { auth } from '../lib/firebase';
import { formatINR } from '../lib/api';
import { fetchMyOrders, updateUserProfileDoc } from '../lib/firestoreStore';
import { SEO } from '../components/SEO';
import { ProductCard } from '../components/ProductCard';
import { ZariflyLogo } from '../components/ZariflyLogo';
import type { Order, Product } from '../types';

export function LoginPage() {
  const {
    user,
    lang,
    loginWithEmail,
    registerWithEmail,
    sendPasswordReset,
    loginWithGoogle,
    requestWhatsAppOtp,
    verifyWhatsAppOtp,
    t,
    notify,
  } = useStore();
  const navigate = useNavigate();

  // Channel: WhatsApp (default prominent) or Email
  const [channel, setChannel] = useState<'whatsapp' | 'email'>('whatsapp');
  const [mode, setMode] = useState<'login' | 'register' | 'reset'>('login');

  // Email states
  const [fullName, setFullName] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [resetSent, setResetSent] = useState(false);

  // WhatsApp OTP states
  const [waPhone, setWaPhone] = useState('');
  const [waName, setWaName] = useState('');
  const [waCode, setWaCode] = useState('');
  const [waOtpMeta, setWaOtpMeta] = useState<WhatsAppOtpRequestResult | null>(null);
  const [waCooldown, setWaCooldown] = useState(0);

  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (user) {
      navigate(user.role === 'admin' || user.role === 'super_admin' ? '/admin' : '/account');
    }
  }, [user, navigate]);

  useEffect(() => {
    if (waCooldown <= 0) return;
    const timer = setInterval(() => {
      setWaCooldown((s) => (s > 1 ? s - 1 : 0));
    }, 1000);
    return () => clearInterval(timer);
  }, [waCooldown]);

  const handleRequestWhatsAppOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      setLoading(true);
      const res = await requestWhatsAppOtp({
        phone: waPhone.trim(),
        fullName: mode === 'register' ? waName.trim() : undefined,
        mode: mode === 'register' ? 'signup' : 'login',
      });
      setWaOtpMeta(res);
      setWaCooldown(30);
      notify(
        res.deliveryMode === 'whatsapp_cloud_api'
          ? 'Verification code sent to your WhatsApp!'
          : 'WhatsApp verification code ready! Verify below or confirm on WhatsApp.',
        'success'
      );
    } catch (err: any) {
      notify(err?.message || 'Unable to generate WhatsApp code.', 'error');
    } finally {
      setLoading(false);
    }
  };

  const handleVerifyWhatsAppOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      setLoading(true);
      const u = await verifyWhatsAppOtp({
        phone: waOtpMeta?.phone || waPhone.trim(),
        code: waCode.trim(),
        fullName: mode === 'register' ? waName.trim() : undefined,
      });
      notify(`Welcome, ${u.fullName}! Signed in with WhatsApp.`, 'success');
      navigate('/account');
    } catch (err: any) {
      notify(err?.message || 'WhatsApp verification failed.', 'error');
    } finally {
      setLoading(false);
    }
  };

  const handleEmailSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      setLoading(true);
      if (mode === 'reset') {
        await sendPasswordReset(email);
        setResetSent(true);
        notify('Password reset link sent to your email.', 'success');
        return;
      }
      const u =
        mode === 'login'
          ? await loginWithEmail(email, password)
          : await registerWithEmail({ fullName, email, password, phone });
      notify(`Welcome, ${u.fullName}!`, 'success');
      navigate(u.role === 'admin' || u.role === 'super_admin' ? '/admin' : '/account');
    } catch (err: any) {
      notify(err?.message || 'Authentication failed.', 'error');
    } finally {
      setLoading(false);
    }
  };

  const handleGoogle = async () => {
    try {
      setLoading(true);
      const u = await loginWithGoogle();
      notify(`Welcome, ${u.fullName}!`, 'success');
      navigate(u.role === 'admin' || u.role === 'super_admin' ? '/admin' : '/account');
    } catch (err: any) {
      notify(err?.message || 'Google Sign-In was cancelled or failed.', 'error');
    } finally {
      setLoading(false);
    }
  };

  const inputClass =
    'w-full px-4 py-3 rounded-2xl text-sm bg-[#FAFAFF] border border-[#E2D9F3] outline-none focus:border-[#7C3AED] focus:bg-white transition-colors';

  return (
    <>
      <SEO
        title="WhatsApp Login & Account | ZARIFLY Boutique"
        description="Sign in or sign up instantly with WhatsApp, Google, or Email on ZARIFLY Boutique to order handcrafted hijabs, naqaabs, and dupattas with Cash on Delivery."
        canonicalPath="/login"
      />

      <div className="min-h-[75vh] bg-gradient-to-br from-[#FFF0F6] via-[#F3EEFF] to-[#ECFEFF] flex items-center justify-center px-4 py-12 sm:py-16">
        <div className="w-full max-w-md bg-white rounded-[32px] border border-[#E9DDFC] p-7 sm:p-10 space-y-6 shadow-[0_20px_55px_rgba(124,58,237,0.12)]">
          <div className="text-center space-y-2.5">
            <div className="flex justify-center">
              <ZariflyLogo size="lg" />
            </div>
            <h1 className="font-serif-display text-3xl font-extrabold text-[#181326]">
              {mode === 'reset'
                ? 'Reset Password'
                : mode === 'register'
                  ? lang === 'hi'
                    ? 'नया अकाउंट बनाएं'
                    : 'Create Your Account'
                  : lang === 'hi'
                    ? 'ZARIFLY में लॉग इन करें'
                    : 'Welcome Back'}
            </h1>
            <p className="text-xs text-[#64597A]">
              {lang === 'hi'
                ? 'WhatsApp, Google या Email से तुरंत साइन इन / साइन अप करें।'
                : 'Sign in or sign up instantly with WhatsApp, Google, or Email.'}
            </p>
          </div>

          {mode !== 'reset' && (
            <>
              {/* Login / Sign Up Switch */}
              <div className="grid grid-cols-2 rounded-full bg-[#FAFAFF] border border-[#E2D9F3] p-1 text-xs font-bold">
                <button
                  type="button"
                  onClick={() => {
                    setMode('login');
                    setResetSent(false);
                    setWaOtpMeta(null);
                    setWaCode('');
                  }}
                  className={`py-2.5 rounded-full transition-all cursor-pointer ${
                    mode === 'login'
                      ? 'bg-gradient-to-r from-[#FF4D8D] to-[#7C3AED] text-white shadow-sm'
                      : 'text-[#64597A]'
                  }`}
                >
                  {t('auth.signIn')}
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setMode('register');
                    setResetSent(false);
                    setWaOtpMeta(null);
                    setWaCode('');
                  }}
                  className={`py-2.5 rounded-full transition-all cursor-pointer ${
                    mode === 'register'
                      ? 'bg-gradient-to-r from-[#FF4D8D] to-[#7C3AED] text-white shadow-sm'
                      : 'text-[#64597A]'
                  }`}
                >
                  {t('auth.register')}
                </button>
              </div>

              {/* Channel Switch: WhatsApp vs Email */}
              <div className="grid grid-cols-2 gap-2.5">
                <button
                  type="button"
                  onClick={() => {
                    setChannel('whatsapp');
                    setResetSent(false);
                  }}
                  className={`py-3 px-3 rounded-2xl text-xs font-extrabold flex items-center justify-center gap-2 border-2 transition-all cursor-pointer ${
                    channel === 'whatsapp'
                      ? 'bg-[#ECFDF5] border-[#25D366] text-[#047857] shadow-xs'
                      : 'bg-white border-[#EDE8F7] text-[#64597A] hover:border-[#25D366]/50'
                  }`}
                >
                  <MessageCircle className="w-4 h-4 text-[#25D366]" />
                  <span>WhatsApp</span>
                </button>
                <button
                  type="button"
                  onClick={() => setChannel('email')}
                  className={`py-3 px-3 rounded-2xl text-xs font-extrabold flex items-center justify-center gap-2 border-2 transition-all cursor-pointer ${
                    channel === 'email'
                      ? 'bg-[#F3EEFF] border-[#7C3AED] text-[#5B21B6] shadow-xs'
                      : 'bg-white border-[#EDE8F7] text-[#64597A] hover:border-[#7C3AED]/50'
                  }`}
                >
                  <Mail className="w-4 h-4 text-[#7C3AED]" />
                  <span>Email</span>
                </button>
              </div>
            </>
          )}

          {/* WHATSAPP LOGIN / SIGNUP FLOW */}
          {channel === 'whatsapp' && mode !== 'reset' ? (
            <div className="space-y-4">
              {!waOtpMeta ? (
                <form onSubmit={handleRequestWhatsAppOtp} className="space-y-4">
                  {mode === 'register' && (
                    <div>
                      <label className="block text-xs font-bold text-[#5E5474] mb-1">
                        {t('auth.fullName')} *
                      </label>
                      <input
                        type="text"
                        required
                        minLength={2}
                        placeholder="e.g. Ayesha Khan"
                        value={waName}
                        onChange={(e) => setWaName(e.target.value)}
                        className={inputClass}
                      />
                    </div>
                  )}

                  <div>
                    <label className="block text-xs font-bold text-[#5E5474] mb-1">
                      WhatsApp Mobile Number *
                    </label>
                    <div className="flex items-center gap-2">
                      <span className="px-3.5 py-3 rounded-2xl text-sm font-bold bg-[#ECFDF5] border border-[#A7F3D0] text-[#047857] tabular-nums">
                        +91
                      </span>
                      <input
                        type="tel"
                        required
                        inputMode="numeric"
                        placeholder="98XXXXXXXX"
                        value={waPhone}
                        onChange={(e) => setWaPhone(e.target.value.replace(/[^\d+\s-]/g, ''))}
                        className={`${inputClass} tabular-nums`}
                      />
                    </div>
                    <p className="text-[11px] text-[#64597A] mt-1.5">
                      {mode === 'register'
                        ? 'Create your ZARIFLY account in seconds with a 6-digit WhatsApp verification code.'
                        : 'Get a 6-digit WhatsApp verification code to sign in instantly.'}
                    </p>
                  </div>

                  <button
                    type="submit"
                    disabled={loading}
                    className="w-full py-4 rounded-full bg-[#25D366] hover:bg-[#1FB858] text-white text-xs font-extrabold uppercase tracking-[0.12em] flex items-center justify-center gap-2 transition-all disabled:opacity-50 shadow-[0_10px_24px_rgba(37,211,102,0.32)] cursor-pointer"
                  >
                    <MessageCircle className="w-4 h-4" />
                    <span>
                      {loading
                        ? t('common.loading')
                        : mode === 'register'
                          ? 'Sign Up with WhatsApp'
                          : 'Continue with WhatsApp'}
                    </span>
                  </button>
                </form>
              ) : (
                <form onSubmit={handleVerifyWhatsAppOtp} className="space-y-4">
                  <div className="rounded-2xl bg-[#ECFDF5] border border-[#A7F3D0] p-4 space-y-2.5">
                    <div className="flex items-center justify-between gap-2">
                      <span className="inline-flex items-center gap-1.5 text-xs font-extrabold text-[#047857]">
                        <Smartphone className="w-4 h-4" />
                        {waOtpMeta.phone}
                      </span>
                      <button
                        type="button"
                        onClick={() => {
                          setWaOtpMeta(null);
                          setWaCode('');
                        }}
                        className="text-[11px] font-bold text-[#047857] underline cursor-pointer"
                      >
                        Change
                      </button>
                    </div>

                    {waOtpMeta.verificationCode && (
                      <div className="rounded-xl bg-white border border-[#A7F3D0] p-3 flex items-center justify-between gap-2">
                        <div>
                          <p className="text-[10px] font-bold uppercase tracking-wider text-[#64597A]">
                            Your 6-Digit WhatsApp Code
                          </p>
                          <p className="text-xl font-extrabold tracking-[0.22em] text-[#181326] tabular-nums">
                            {waOtpMeta.verificationCode}
                          </p>
                        </div>
                        <button
                          type="button"
                          onClick={() => setWaCode(waOtpMeta.verificationCode || '')}
                          className="px-3.5 py-2 rounded-full bg-[#25D366] text-white text-[11px] font-extrabold uppercase tracking-wider hover:brightness-105 cursor-pointer"
                        >
                          Autofill
                        </button>
                      </div>
                    )}

                    <a
                      href={waOtpMeta.whatsappUrl}
                      target="_blank"
                      rel="noreferrer"
                      className="w-full py-2.5 px-4 rounded-xl bg-white border border-[#25D366] text-[#047857] text-xs font-extrabold flex items-center justify-center gap-1.5 hover:bg-[#25D366] hover:text-white transition-colors"
                    >
                      <MessageCircle className="w-4 h-4" />
                      <span>Open WhatsApp Chat</span>
                      <ExternalLink className="w-3.5 h-3.5" />
                    </a>
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-[#5E5474] mb-1">
                      Enter 6-Digit Verification Code *
                    </label>
                    <input
                      type="text"
                      required
                      inputMode="numeric"
                      maxLength={6}
                      placeholder="• • • • • •"
                      value={waCode}
                      onChange={(e) => setWaCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                      className={`${inputClass} text-center text-lg font-extrabold tracking-[0.35em] tabular-nums`}
                    />
                  </div>

                  <button
                    type="submit"
                    disabled={loading || waCode.length !== 6}
                    className="w-full py-4 rounded-full bg-gradient-to-r from-[#25D366] to-[#10B981] text-white text-xs font-extrabold uppercase tracking-[0.14em] hover:brightness-105 transition-all disabled:opacity-50 shadow-md cursor-pointer"
                  >
                    {loading ? t('common.loading') : 'Verify & Continue'}
                  </button>

                  <div className="text-center">
                    <button
                      type="button"
                      disabled={waCooldown > 0 || loading}
                      onClick={(e) => handleRequestWhatsAppOtp(e as any)}
                      className="text-xs font-bold text-[#7C3AED] hover:text-[#FF4D8D] disabled:opacity-50 cursor-pointer"
                    >
                      {waCooldown > 0
                        ? `Resend code in ${waCooldown}s`
                        : 'Resend WhatsApp Code'}
                    </button>
                  </div>
                </form>
              )}
            </div>
          ) : mode === 'reset' && resetSent ? (
            <div className="rounded-2xl bg-emerald-50 border border-emerald-200 p-5 text-center space-y-3">
              <KeyRound className="w-8 h-8 text-emerald-600 mx-auto" />
              <p className="text-sm font-semibold text-[#181326]">Password Reset Email Sent</p>
              <p className="text-xs text-[#5E5474]">
                Check <strong>{email}</strong> for a Firebase password reset link, then sign in with
                your new password.
              </p>
              <button
                type="button"
                onClick={() => {
                  setMode('login');
                  setResetSent(false);
                }}
                className="px-6 py-2.5 rounded-full bg-[#181326] text-white text-xs font-bold uppercase tracking-wider cursor-pointer"
              >
                Back to Sign In
              </button>
            </div>
          ) : (
            <form onSubmit={handleEmailSubmit} className="space-y-4">
              {mode === 'register' && (
                <>
                  <div>
                    <label className="block text-xs font-bold text-[#5E5474] mb-1">
                      {t('auth.fullName')}
                    </label>
                    <input
                      type="text"
                      required
                      value={fullName}
                      onChange={(e) => setFullName(e.target.value)}
                      className={inputClass}
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-[#5E5474] mb-1">
                      {t('auth.phone')}
                    </label>
                    <input
                      type="tel"
                      value={phone}
                      onChange={(e) => setPhone(e.target.value)}
                      className={inputClass}
                    />
                  </div>
                </>
              )}

              <div>
                <label className="block text-xs font-bold text-[#5E5474] mb-1">
                  {t('auth.email')}
                </label>
                <input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className={inputClass}
                />
              </div>

              {mode !== 'reset' && (
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="block text-xs font-bold text-[#5E5474]">
                      {t('auth.password')}
                    </label>
                    {mode === 'login' && (
                      <button
                        type="button"
                        onClick={() => setMode('reset')}
                        className="text-[11px] font-bold text-[#7C3AED] hover:text-[#FF4D8D] cursor-pointer"
                      >
                        Forgot password?
                      </button>
                    )}
                  </div>
                  <input
                    type="password"
                    required
                    minLength={6}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className={inputClass}
                  />
                </div>
              )}

              <button
                type="submit"
                disabled={loading}
                className="w-full py-4 rounded-full bg-gradient-to-r from-[#FF4D8D] via-[#EC4899] to-[#7C3AED] text-white text-xs font-extrabold uppercase tracking-[0.14em] hover:brightness-110 transition-all disabled:opacity-50 shadow-[0_10px_24px_rgba(255,77,141,0.3)] cursor-pointer"
              >
                {loading
                  ? t('common.loading')
                  : mode === 'login'
                    ? t('auth.signIn')
                    : mode === 'register'
                      ? t('auth.register')
                      : 'Send Password Reset Link'}
              </button>

              {mode === 'reset' && (
                <button
                  type="button"
                  onClick={() => setMode('login')}
                  className="w-full text-xs font-bold text-[#64597A] hover:text-[#181326] py-1 cursor-pointer"
                >
                  Back to Sign In
                </button>
              )}
            </form>
          )}

          {mode !== 'reset' && (
            <>
              <div className="relative flex items-center py-0.5">
                <div className="flex-grow border-t border-[#EDE8F7]" />
                <span className="shrink mx-3 text-[11px] text-[#8B7FA6] uppercase font-bold">
                  or continue with
                </span>
                <div className="flex-grow border-t border-[#EDE8F7]" />
              </div>

              <button
                type="button"
                disabled={loading}
                onClick={handleGoogle}
                className="w-full py-3.5 px-4 rounded-full border-2 border-[#181326] bg-white text-[#181326] text-xs font-extrabold tracking-wider uppercase hover:bg-[#F3EEFF] hover:border-[#7C3AED] transition-colors flex items-center justify-center gap-2.5 cursor-pointer"
              >
                <span>{t('auth.googleSignIn')}</span>
              </button>
            </>
          )}
        </div>
      </div>
    </>
  );
}

export function AccountPage() {
  const { user, authLoading, lang, logout, refreshAuth, updateWhatsAppProfile, t, notify } =
    useStore();
  const navigate = useNavigate();
  const [orders, setOrders] = useState<Order[]>([]);
  const [fullName, setFullName] = useState('');
  const [phone, setPhone] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!authLoading && !user) {
      navigate('/login');
    }
  }, [authLoading, user, navigate]);

  useEffect(() => {
    if (user) {
      setFullName(user.fullName || '');
      setPhone(user.phone || '');
      fetchMyOrders(user.uid)
        .then((res) => setOrders(res))
        .catch(() => {});
    }
  }, [user]);

  const handleSaveProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    try {
      setSaving(true);
      if (user.authProvider === 'whatsapp' || !auth.currentUser) {
        await updateWhatsAppProfile({
          fullName: fullName.trim(),
          preferredLang: lang,
        });
      } else {
        await updateUserProfileDoc(user.uid, {
          fullName: fullName.trim(),
          phone: phone.trim(),
          preferredLang: lang,
        });
        if (auth.currentUser && fullName.trim()) {
          await updateProfile(auth.currentUser, { displayName: fullName.trim() }).catch(() => {});
        }
        await refreshAuth();
      }
      notify('Profile updated.', 'success');
    } catch (err: any) {
      notify(err?.message || 'Unable to update profile.', 'error');
    } finally {
      setSaving(false);
    }
  };

  if (!user) return null;
  const isAdmin = user.role === 'admin' || user.role === 'super_admin';
  const isWhatsAppUser = user.authProvider === 'whatsapp';

  return (
    <>
      <SEO
        title="My Account | ZARIFLY Boutique"
        description="Manage your ZARIFLY customer profile and view your handcrafted modest wear order history."
        canonicalPath="/account"
      />

      <div className="max-w-[1440px] mx-auto px-4 sm:px-8 py-10 sm:py-14 space-y-10">
        <div className="rounded-[30px] bg-gradient-to-r from-[#FFF0F6] via-[#F3EEFF] to-[#ECFEFF] border border-[#E9DDFC] p-6 sm:p-8 flex flex-wrap items-center justify-between gap-4">
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <p className="text-xs font-extrabold tracking-[0.18em] uppercase text-[#FF4D8D]">
                Member Profile
              </p>
              {isWhatsAppUser && (
                <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-[#ECFDF5] border border-[#A7F3D0] text-[10px] font-extrabold text-[#047857]">
                  <CheckCircle2 className="w-3 h-3 text-[#25D366]" />
                  WhatsApp Verified
                </span>
              )}
            </div>
            <h1 className="font-serif-display text-3xl sm:text-5xl font-extrabold text-[#181326] mt-1">
              {user.fullName}
            </h1>
            <p className="text-xs text-[#64597A] mt-1">
              {isWhatsAppUser ? user.phone : user.email}
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            {isAdmin && (
              <Link
                to="/admin"
                className="inline-flex items-center gap-2 px-5 py-3 rounded-full bg-gradient-to-r from-[#FF4D8D] to-[#7C3AED] text-white text-xs font-extrabold uppercase tracking-wider shadow-md"
              >
                <Shield className="w-4 h-4" />
                Admin Dashboard
              </Link>
            )}
            <button
              type="button"
              onClick={() => logout().then(() => navigate('/'))}
              className="inline-flex items-center gap-2 px-5 py-3 rounded-full bg-white border border-[#181326] text-xs font-extrabold uppercase tracking-wider hover:bg-[#181326] hover:text-white transition-colors cursor-pointer"
            >
              <LogOut className="w-4 h-4" />
              {t('auth.logout')}
            </button>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
          <form
            onSubmit={handleSaveProfile}
            className="lg:col-span-4 bg-white rounded-[28px] border border-[#EDE8F7] p-6 sm:p-7 space-y-4 h-fit shadow-xs"
          >
            <h2 className="font-serif-display text-2xl font-extrabold text-[#181326] flex items-center gap-2">
              <UserIcon className="w-5 h-5 text-[#7C3AED]" />
              Profile Details
            </h2>
            <div>
              <label className="block text-xs font-bold text-[#5E5474] mb-1">
                {t('auth.fullName')}
              </label>
              <input
                type="text"
                required
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                className="w-full px-4 py-3 rounded-2xl text-sm bg-[#FAFAFF] border border-[#E2D9F3] outline-none focus:border-[#7C3AED]"
              />
            </div>
            <div>
              <label className="block text-xs font-bold text-[#5E5474] mb-1">
                {isWhatsAppUser ? 'Verified WhatsApp Number' : t('auth.phone')}
              </label>
              <input
                type="tel"
                value={phone}
                disabled={isWhatsAppUser}
                onChange={(e) => setPhone(e.target.value)}
                className="w-full px-4 py-3 rounded-2xl text-sm bg-[#FAFAFF] border border-[#E2D9F3] outline-none focus:border-[#7C3AED] disabled:opacity-65"
              />
            </div>
            <button
              type="submit"
              disabled={saving}
              className="w-full py-3.5 rounded-full bg-gradient-to-r from-[#FF4D8D] to-[#7C3AED] text-white text-xs font-extrabold uppercase tracking-wider hover:brightness-110 transition-all cursor-pointer"
            >
              {saving ? t('common.loading') : t('common.save')}
            </button>
          </form>

          <div className="lg:col-span-8 space-y-4">
            <h2 className="font-serif-display text-3xl font-extrabold text-[#181326] flex items-center gap-2">
              <Package className="w-5 h-5 text-[#FF4D8D]" />
              Order History ({orders.length})
            </h2>

            {orders.length === 0 ? (
              <div className="bg-white rounded-[28px] border border-[#EDE8F7] p-10 text-center space-y-4">
                <p className="text-sm text-[#64597A]">You have not placed any orders yet.</p>
                <Link
                  to="/shop"
                  className="inline-block px-7 py-3.5 rounded-full bg-gradient-to-r from-[#FF4D8D] to-[#7C3AED] text-white text-xs font-extrabold uppercase tracking-wider"
                >
                  Explore Collection
                </Link>
              </div>
            ) : (
              orders.map((order) => (
                <div
                  key={order.id}
                  className="bg-white rounded-[24px] border border-[#EDE8F7] p-5 sm:p-6 space-y-3 shadow-xs"
                >
                  <div className="flex flex-wrap items-center justify-between gap-2 pb-3 border-b border-[#EDE8F7]">
                    <div>
                      <p className="text-xs font-extrabold text-[#181326] tabular-nums">
                        #{order.orderNumber}
                      </p>
                      <p className="text-[11px] text-[#64597A] mt-0.5">
                        {new Date(order.createdAt).toLocaleDateString('en-IN')} ·{' '}
                        <span className="capitalize">{order.orderStatus.replace(/_/g, ' ')}</span> ·{' '}
                        <span className="uppercase">{order.paymentMethod}</span>
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="text-base font-extrabold tabular-nums text-[#181326]">
                        {formatINR(order.grandTotal)}
                      </p>
                      <Link
                        to={`/order-confirmation?order=${encodeURIComponent(order.orderNumber)}`}
                        className="text-xs font-bold text-[#7C3AED] hover:text-[#FF4D8D] hover:underline"
                      >
                        View Receipt
                      </Link>
                    </div>
                  </div>
                  <div className="text-xs text-[#5E5474] space-y-1">
                    {(order.items || []).map((item) => (
                      <p key={item.id}>
                        {item.productName} ({item.colorName}, {item.sizeName}) × {item.quantity}
                      </p>
                    ))}
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </>
  );
}

export function WishlistPage() {
  const { user, wishlistIds, bootstrap, bootstrapLoading, t } = useStore();
  const items: Product[] = (bootstrap?.allProducts || []).filter((p) =>
    wishlistIds.includes(p.id)
  );

  return (
    <>
      <SEO
        title="Saved Wishlist | ZARIFLY Boutique"
        description="Your curated wishlist of handcrafted ZARIFLY hijabs, naqaabs, and designer dupattas."
        canonicalPath="/wishlist"
      />

      <div className="max-w-[1440px] mx-auto px-4 sm:px-8 py-10 sm:py-14">
        <div className="mb-8 space-y-1">
          <p className="text-xs font-extrabold tracking-[0.2em] uppercase text-[#FF4D8D]">
            Saved Favourites
          </p>
          <h1 className="font-serif-display text-4xl sm:text-5xl font-extrabold text-[#181326]">
            {t('nav.wishlist')}
          </h1>
        </div>

        {!user ? (
          <div className="bg-white rounded-[32px] border border-[#EDE8F7] py-16 px-6 text-center space-y-4 shadow-xs">
            <div className="w-16 h-16 rounded-full bg-[#FFF0F6] mx-auto flex items-center justify-center">
              <Heart className="w-7 h-7 text-[#FF4D8D]" />
            </div>
            <p className="text-sm text-[#64597A]">
              Sign in with WhatsApp or Google to access your saved wishlist.
            </p>
            <Link
              to="/login"
              className="inline-block px-7 py-3.5 rounded-full bg-gradient-to-r from-[#FF4D8D] to-[#7C3AED] text-white text-xs font-extrabold uppercase tracking-wider"
            >
              {t('auth.signIn')}
            </Link>
          </div>
        ) : bootstrapLoading ? (
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-6">
            {[1, 2, 3, 4].map((n) => (
              <div key={n} className="aspect-[3/4] rounded-[24px] bg-white animate-pulse" />
            ))}
          </div>
        ) : items.length === 0 ? (
          <div className="bg-white rounded-[32px] border border-[#EDE8F7] py-16 px-6 text-center space-y-4">
            <p className="text-sm text-[#64597A]">Your wishlist is currently empty.</p>
            <Link
              to="/shop"
              className="inline-block px-7 py-3.5 rounded-full bg-gradient-to-r from-[#FF4D8D] to-[#7C3AED] text-white text-xs font-extrabold uppercase tracking-wider"
            >
              Explore Collections
            </Link>
          </div>
        ) : (
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-6">
            {items.map((product, idx) => (
              <ProductCard key={product.id} product={product} index={idx} />
            ))}
          </div>
        )}
      </div>
    </>
  );
}
