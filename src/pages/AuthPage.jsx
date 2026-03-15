import React, { useState, useRef } from 'react';
import axios from 'axios';
import { API_URL } from '../config';
import { Mail, Lock, User, Camera, ArrowRight, Loader2 } from 'lucide-react';
import { Link, useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import { motion, AnimatePresence } from 'framer-motion';
import ImageCropper from '../components/ImageCropper';

const AuthPage = () => {
  const [isLogin, setIsLogin] = useState(true);
  const [loading, setLoading] = useState(false);
  const [form, setForm] = useState({ username: '', email: '', password: '' });
  const [otpCode, setOtpCode] = useState('');
  const [registerOtpSent, setRegisterOtpSent] = useState(false);
  const [profileFile, setProfileFile] = useState(null);
  const [profilePreview, setProfilePreview] = useState(null);
  const [cropSrc, setCropSrc] = useState(null);
  const [emailError, setEmailError] = useState('');
  const [otpError, setOtpError] = useState('');
  const [otpAttempts, setOtpAttempts] = useState(0);
  const [termsAccepted, setTermsAccepted] = useState(false);
  const [termsError, setTermsError] = useState('');
  const profileInputRef = useRef(null);
  const navigate = useNavigate();

  const normalizeEmailInput = (email) => String(email || '').
  normalize('NFKC').
  replace(/[\u200B-\u200D\uFEFF]/g, '').
  trim().
  toLowerCase();

  const isValidEmail = (email) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);

  const generateCanvasFingerprint = () => {
    try {
      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d');
      canvas.width = 200;
      canvas.height = 50;
      const txt = 'Pariwartan.Nepal.Secure.ID.123';
      ctx.textBaseline = "top";
      ctx.font = "14px 'Mukta'";
      ctx.textBaseline = "alphabetic";
      ctx.fillStyle = "#f60";
      ctx.fillRect(125, 1, 62, 20);
      ctx.fillStyle = "#069";
      ctx.fillText(txt, 2, 15);
      ctx.fillStyle = "rgba(102, 204, 0, 0.7)";
      ctx.fillText(txt, 4, 17);
      return canvas.toDataURL();
    } catch (e) {
      return 'Canvas-Not-Supported';
    }
  };

  const getDeviceContext = () => {
    let deviceId = localStorage.getItem('deviceId');
    if (!deviceId) {
      deviceId = Math.random().toString(36).substring(2) + Date.now().toString(36);
      localStorage.setItem('deviceId', deviceId);
    }

    const deviceFootprint = {
      width: window.screen.width,
      height: window.screen.height,
      userAgent: navigator.userAgent,
      language: navigator.language,
      platform: navigator.platform,
      timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
      canvas: generateCanvasFingerprint(),
      colorDepth: window.screen.colorDepth,
      pixelRatio: window.devicePixelRatio,
      hardwareConcurrency: navigator.hardwareConcurrency || 'unknown'
    };

    return { deviceId, deviceFootprint };
  };

  const requestRegisterOtp = async () => {
    setEmailError('');
    const normalizedEmail = normalizeEmailInput(form.email);
    if (!isValidEmail(normalizedEmail)) {
      setEmailError('Please enter a valid email address');
      toast.error('Invalid email address');
      return;
    }
    const payload = {
      username: form.username,
      email: normalizedEmail,
      password: form.password
    };
    try {
      const r = await axios.post(`${API_URL}/api/auth/register/request-code`, payload);
      setRegisterOtpSent(true);
      setOtpAttempts(0);
      if (r?.data?.devCode) {
        setOtpCode(String(r.data.devCode));
        toast.success(`Dev OTP: ${r.data.devCode}`);
      } else {
        toast.success('Verification code sent to your email');
      }
    } catch (err) {
      const errMsg = err.response?.data?.message || 'Failed to send code';
      if (/invalid\s+email|email\s+format|email.*invalid|valid\s+email/i.test(errMsg)) {
        setEmailError('Please enter a valid email address');
        toast.error('Invalid email address');
      } else {
        toast.error(errMsg);
      }
    }
  };

  const verifyRegisterOtpAndCreateAccount = async () => {
    setOtpError('');
    const normalizedEmail = normalizeEmailInput(form.email);
    const { deviceId, deviceFootprint } = getDeviceContext();
    try {
      const r = await axios.post(`${API_URL}/api/auth/register/verify-code`, {
        username: form.username,
        email: normalizedEmail,
        password: form.password,
        code: otpCode,
        deviceId,
        deviceFootprint
      });

      localStorage.setItem('token', r.data.token);
      localStorage.setItem('user', JSON.stringify(r.data.user));


      if (profileFile) {
        const fd = new FormData();
        fd.append('profilePic', profileFile, 'profile.jpg');
        const picRes = await axios.post(`${API_URL}/api/user/profile-pic`, fd, {
          headers: {
            Authorization: `Bearer ${r.data.token}`,
            'Content-Type': 'multipart/form-data'
          }
        });
        const user = JSON.parse(localStorage.getItem('user') || 'null');
        if (user && picRes?.data?.profilePic) {
          user.profilePic = picRes.data.profilePic;
          localStorage.setItem('user', JSON.stringify(user));
        }
      }

      toast.success('Account created!');
      navigate('/');
    } catch (err) {
      const errMsg = err.response?.data?.message || 'Verification failed';
      if (errMsg.toLowerCase().includes('code') || errMsg.toLowerCase().includes('invalid') || errMsg.toLowerCase().includes('expired')) {
        setOtpError(errMsg);
        setOtpAttempts((prev) => prev + 1);
        if (otpAttempts >= 4) {
          toast.error('Too many failed attempts. Please request a new code.');
          setRegisterOtpSent(false);
          setOtpCode('');
          setOtpAttempts(0);
        } else {
          toast.error(errMsg);
        }
      } else {
        toast.error(errMsg);
      }
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!registerOtpSent && !termsAccepted) {
      setTermsError('You must accept Terms and Services to continue.');
      toast.error('Please accept Terms and Services');
      return;
    }
    setLoading(true);

    try {
      if (isLogin) {
        const { deviceId, deviceFootprint } = getDeviceContext();
        const r = await axios.post(`${API_URL}/api/auth/login`, {
          ...form,
          email: normalizeEmailInput(form.email),
          deviceId,
          deviceFootprint
        });
        localStorage.setItem('token', r.data.token);
        localStorage.setItem('user', JSON.stringify(r.data.user));
        toast.success('Welcome back!');
        navigate('/');
      } else {
        if (!registerOtpSent) {
          await requestRegisterOtp();
        } else {
          if (!otpCode.trim()) {
            setOtpError('Enter the 6-digit verification code');
            toast.error('Enter the 6-digit verification code');
            return;
          }
          await verifyRegisterOtpAndCreateAccount();
        }
      }
    } catch (err) {
      const errMsg = err.response?.data?.message || 'Authentication failed.';
      if (!isLogin && !registerOtpSent) {
        if (errMsg.toLowerCase().includes('email')) {
          setEmailError('Please enter a valid email address');
        }
      }
      toast.error(errMsg);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ minHeight: '100svh', background: 'var(--bg)', display: 'flex' }}>
      {}
      <motion.div
        initial={{ opacity: 0, x: -20 }}
        animate={{ opacity: 1, x: 0 }}
        transition={{ duration: 0.5 }}
        style={{
          flex: 1,
          display: 'none',
          flexDirection: 'column',
          justifyContent: 'center',
          alignItems: 'center',
          padding: '40px',
          background: 'linear-gradient(135deg, var(--bg-secondary) 0%, var(--bg-tertiary) 100%)',
          borderRight: '1px solid var(--border)'
        }}>
        
        <motion.div
          animate={{ y: [0, -10, 0] }}
          transition={{ duration: 3, repeat: Infinity }}
          style={{
            fontSize: '4rem',
            marginBottom: '20px'
          }}>
          
          🌍
        </motion.div>
        <h2 style={{ fontSize: '2rem', fontWeight: 800, color: 'var(--text)', marginBottom: 16, textAlign: 'center' }}>
          Pariwartan
        </h2>
        <p style={{ fontSize: '1rem', color: 'var(--text-secondary)', textAlign: 'center', maxWidth: 300, lineHeight: 1.6 }}>
          Join a community making a difference. Report issues, share solutions, drive real change.
        </p>
      </motion.div>

      {}
      <motion.div
        initial={{ opacity: 0, x: 20 }}
        animate={{ opacity: 1, x: 0 }}
        transition={{ duration: 0.5 }}
        style={{
          flex: 1,
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'center',
          alignItems: 'center',
          padding: 'clamp(16px, 5vw, 40px)',
          minWidth: '100%',
          minHeight: '100svh'
        }}>
        
        <div style={{ width: '100%', maxWidth: 420 }}>
          {}
          <motion.div
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ type: 'spring', stiffness: 100, damping: 20 }}
            style={{
              textAlign: 'center',
              marginBottom: 32,
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              gap: 12
            }}>
            
            <div style={{ fontSize: '2.5rem' }}>🌍</div>
            <div>
              <h1 style={{
                fontSize: '1.75rem',
                fontWeight: 900,
                color: 'var(--text)',
                margin: 0,
                letterSpacing: '-0.02em'
              }}>
                Pariwartan
              </h1>
              <p style={{
                fontSize: '0.9rem',
                color: 'var(--text-secondary)',
                margin: '8px 0 0',
                fontWeight: 500
              }}>
                {registerOtpSent ? 'Verify your email' : isLogin ? 'Welcome back' : 'Join the movement'}
              </p>
            </div>
          </motion.div>

          {}
          {!registerOtpSent &&
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
            style={{
              display: 'flex',
              gap: 8,
              marginBottom: 28,
              background: 'var(--bg-secondary)',
              padding: 4,
              borderRadius: 10,
              border: '1px solid var(--border)'
            }}>
            
              {[
            { label: 'Sign In', val: true },
            { label: 'Sign Up', val: false }].
            map(({ label, val }) =>
            <motion.button
              key={label}
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              onClick={() => {
                setIsLogin(val);
                setOtpCode('');
                setEmailError('');
                setTermsError('');
              }}
              style={{
                flex: 1,
                padding: '10px 16px',
                background: isLogin === val ? 'var(--surface)' : 'transparent',
                color: isLogin === val ? 'var(--accent)' : 'var(--text-secondary)',
                border: isLogin === val ? '1px solid var(--border)' : 'none',
                borderRadius: 8,
                fontSize: '0.9rem',
                fontWeight: isLogin === val ? 700 : 500,
                cursor: 'pointer',
                transition: 'all 0.2s ease',
                boxShadow: isLogin === val ? 'var(--shadow-sm)' : 'none'
              }}>
              
                  {label}
                </motion.button>
            )}
            </motion.div>
          }

          {}
          <AnimatePresence mode="wait">
            {!registerOtpSent ?
            <motion.form
              key={isLogin ? 'login' : 'register'}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              transition={{ type: 'spring', stiffness: 100, damping: 25 }}
              onSubmit={handleSubmit}
              style={{
                display: 'flex',
                flexDirection: 'column',
                gap: 16,
                background: 'var(--surface)',
                padding: 24,
                borderRadius: 16,
                border: '1px solid var(--border)',
                boxShadow: 'var(--shadow-sm)'
              }}>
              
                {}
                <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.05 }}>
                
                  <label style={{
                  display: 'block',
                  fontSize: '0.8rem',
                  fontWeight: 700,
                  color: 'var(--text-secondary)',
                  marginBottom: 6,
                  textTransform: 'uppercase',
                  letterSpacing: '0.05em'
                }}>
                    Email
                  </label>
                  <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
                    <Mail size={16} style={{
                    position: 'absolute',
                    left: 12,
                    color: 'var(--text-tertiary)',
                    pointerEvents: 'none'
                  }} />
                    <input
                    type="email"
                    placeholder="you@example.com"
                    value={form.email}
                    onChange={(e) => {
                      setForm({ ...form, email: e.target.value });
                      if (emailError) setEmailError('');
                    }}
                    required
                    style={{
                      width: '100%',
                      padding: '10px 12px 10px 40px',
                      border: `1.5px solid ${emailError ? '#ef4444' : 'var(--border)'}`,
                      borderRadius: 10,
                      background: 'var(--bg)',
                      color: 'var(--text)',
                      fontSize: '0.9rem',
                      fontFamily: 'inherit',
                      fontWeight: 500,
                      transition: 'all 0.2s ease',
                      boxSizing: 'border-box'
                    }}
                    onFocus={(e) => e.target.style.borderColor = emailError ? '#ef4444' : 'var(--accent)'}
                    onBlur={(e) => e.target.style.borderColor = emailError ? '#ef4444' : 'var(--border)'} />
                  
                  </div>
                  {emailError &&
                <motion.p
                  initial={{ opacity: 0, y: -5 }}
                  animate={{ opacity: 1, y: 0 }}
                  style={{
                    fontSize: '0.75rem',
                    color: '#ef4444',
                    margin: '4px 0 0',
                    fontWeight: 500
                  }}>
                  
                      ❌ {emailError}
                    </motion.p>
                }
                </motion.div>

              {}
              <AnimatePresence>
                {!isLogin &&
                <motion.div
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: 'auto' }}
                  exit={{ opacity: 0, height: 0 }}
                  transition={{ type: 'spring', stiffness: 100, damping: 25 }}>
                  
                    <label style={{
                    display: 'block',
                    fontSize: '0.8rem',
                    fontWeight: 700,
                    color: 'var(--text-secondary)',
                    marginBottom: 6,
                    textTransform: 'uppercase',
                    letterSpacing: '0.05em'
                  }}>
                      Username
                    </label>
                    <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
                      <User size={16} style={{
                      position: 'absolute',
                      left: 12,
                      color: 'var(--text-tertiary)',
                      pointerEvents: 'none'
                    }} />
                      <input
                      type="text"
                      placeholder="yourname"
                      value={form.username}
                      onChange={(e) => setForm({ ...form, username: e.target.value })}
                      style={{
                        width: '100%',
                        padding: '10px 12px 10px 40px',
                        border: '1.5px solid var(--border)',
                        borderRadius: 10,
                        background: 'var(--bg)',
                        color: 'var(--text)',
                        fontSize: '0.9rem',
                        fontFamily: 'inherit',
                        fontWeight: 500,
                        transition: 'all 0.2s ease',
                        boxSizing: 'border-box'
                      }}
                      onFocus={(e) => e.target.style.borderColor = 'var(--accent)'}
                      onBlur={(e) => e.target.style.borderColor = 'var(--border)'} />
                    
                    </div>
                  </motion.div>
                }
              </AnimatePresence>

              {}
              <AnimatePresence>
                {!isLogin &&
                <motion.div
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: 'auto' }}
                  exit={{ opacity: 0, height: 0 }}
                  transition={{ type: 'spring', stiffness: 100, damping: 25 }}>
                  
                    <label style={{
                    display: 'block',
                    fontSize: '0.8rem',
                    fontWeight: 700,
                    color: 'var(--text-secondary)',
                    marginBottom: 6,
                    textTransform: 'uppercase',
                    letterSpacing: '0.05em'
                  }}>
                      Profile Picture <span style={{ fontWeight: 400, textTransform: 'none' }}>(Optional)</span>
                    </label>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
                      <motion.div
                      whileHover={{ scale: 1.05 }}
                      whileTap={{ scale: 0.95 }}
                      onClick={() => profileInputRef.current?.click()}
                      style={{
                        width: 64, height: 64, borderRadius: '50%',
                        border: '2px dashed var(--border)',
                        background: profilePreview ? 'none' : 'var(--bg)',
                        cursor: 'pointer', overflow: 'hidden',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        flexShrink: 0
                      }}>
                        {profilePreview ?
                      <img src={profilePreview} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} /> :

                      <Camera size={22} style={{ color: 'var(--text-tertiary)' }} />
                      }
                      </motion.div>
                      <div>
                        <button
                        type="button"
                        onClick={() => profileInputRef.current?.click()}
                        style={{
                          padding: '7px 14px', borderRadius: 8,
                          border: '1.5px solid var(--border)', background: 'var(--bg)',
                          color: 'var(--text-secondary)', fontSize: '0.8rem', fontWeight: 600,
                          cursor: 'pointer'
                        }}>
                          {profilePreview ? 'Change' : 'Upload'}
                        </button>
                        <p style={{ fontSize: '0.7rem', color: 'var(--text-tertiary)', margin: '4px 0 0' }}>
                          JPG, PNG, WebP
                        </p>
                      </div>
                    </div>
                    <input
                    ref={profileInputRef}
                    type="file"
                    accept="image/jpeg,image/png,image/webp"
                    style={{ display: 'none' }}
                    onChange={(e) => {
                      const file = e.target.files?.[0];
                      if (!file) return;
                      if (file.size > 5 * 1024 * 1024) {toast.error('Image must be under 5MB');return;}
                      const reader = new FileReader();
                      reader.onload = () => setCropSrc(reader.result);
                      reader.readAsDataURL(file);
                      e.target.value = '';
                    }} />
                  
                  </motion.div>
                }
              </AnimatePresence>

              {}
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.1 }}>
                
                <label style={{
                  display: 'block',
                  fontSize: '0.8rem',
                  fontWeight: 700,
                  color: 'var(--text-secondary)',
                  marginBottom: 6,
                  textTransform: 'uppercase',
                  letterSpacing: '0.05em'
                }}>
                  Password
                </label>
                <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
                  <Lock size={16} style={{
                    position: 'absolute',
                    left: 12,
                    color: 'var(--text-tertiary)',
                    pointerEvents: 'none'
                  }} />
                  <input
                    type="password"
                    placeholder="••••••••"
                    value={form.password}
                    onChange={(e) => setForm({ ...form, password: e.target.value })}
                    required
                    style={{
                      width: '100%',
                      padding: '10px 12px 10px 40px',
                      border: '1.5px solid var(--border)',
                      borderRadius: 10,
                      background: 'var(--bg)',
                      color: 'var(--text)',
                      fontSize: '0.9rem',
                      fontFamily: 'inherit',
                      fontWeight: 500,
                      transition: 'all 0.2s ease',
                      boxSizing: 'border-box',
                      letterSpacing: '0.1em'
                    }}
                    onFocus={(e) => e.target.style.borderColor = 'var(--accent)'}
                    onBlur={(e) => e.target.style.borderColor = 'var(--border)'} />
                  
                </div>
              </motion.div>

              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.12 }}
                style={{
                  display: 'flex',
                  flexDirection: 'column',
                  gap: 6,
                }}
              >
                <div
                  role="button"
                  tabIndex={0}
                  onClick={() => {
                    setTermsAccepted((prev) => {
                      const next = !prev;
                      if (next) setTermsError('');
                      return next;
                    });
                  }}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      e.preventDefault();
                      setTermsAccepted((prev) => {
                        const next = !prev;
                        if (next) setTermsError('');
                        return next;
                      });
                    }
                  }}
                  style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 10,
                  cursor: 'pointer',
                  color: 'var(--text-secondary)',
                  fontSize: '0.82rem',
                  lineHeight: 1.45,
                  padding: '8px 4px',
                  touchAction: 'manipulation',
                  borderRadius: 8,
                  border: '1px solid var(--border-light)',
                  background: 'var(--surface-alt)',
                }}>
                  <input
                    id="terms-agree"
                    type="checkbox"
                    checked={termsAccepted}
                    onClick={(e) => e.stopPropagation()}
                    onChange={(e) => {
                      setTermsAccepted(e.target.checked);
                      if (e.target.checked) setTermsError('');
                    }}
                    style={{
                      margin: 0,
                      width: 18,
                      height: 18,
                      flexShrink: 0,
                      cursor: 'pointer',
                      WebkitAppearance: 'auto',
                      appearance: 'auto',
                      accentColor: '#2563eb',
                    }}
                  />
                  <span>
                    I agree to the{' '}
                    <Link
                      to="/terms"
                      target="_blank"
                      rel="noopener noreferrer"
                      onClick={(e) => e.stopPropagation()}
                      style={{ color: 'var(--accent)', textDecoration: 'underline', fontWeight: 700 }}
                    >
                      Terms and Services
                    </Link>
                    .
                  </span>
                </div>
                {termsError && (
                  <p style={{ margin: 0, color: '#ef4444', fontSize: '0.74rem', fontWeight: 600 }}>
                    {termsError}
                  </p>
                )}
              </motion.div>

              {}
              <motion.button
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.15 }}
                whileHover={{ scale: 1.02, y: -2 }}
                whileTap={{ scale: 0.98 }}
                type="submit"
                disabled={loading}
                style={{
                  width: '100%',
                  padding: '12px 16px',
                  background: loading ? 'var(--text-tertiary)' : 'var(--accent)',
                  color: 'white',
                  border: 'none',
                  borderRadius: 10,
                  fontSize: '0.95rem',
                  fontWeight: 700,
                  cursor: loading ? 'not-allowed' : 'pointer',
                  transition: 'all 0.2s ease',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: 8,
                  boxShadow: loading ? 'var(--shadow-sm)' : 'var(--shadow-md)',
                  opacity: loading ? 0.8 : 1
                }}>
                
                {loading ?
                <>
                    <Loader2 size={18} style={{ animation: 'spin 1s linear infinite' }} />
                    Processing...
                  </> :

                <>
                    {isLogin ? 'Sign In' : registerOtpSent ? 'Verify & Create Account' : 'Send Verification Code'}
                    <ArrowRight size={18} />
                  </>
                }
              </motion.button>
            </motion.form> :

            <motion.form
              key="otp-verify"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              transition={{ type: 'spring', stiffness: 100, damping: 25 }}
              onSubmit={handleSubmit}
              style={{
                display: 'flex',
                flexDirection: 'column',
                gap: 16,
                background: 'var(--surface)',
                padding: 24,
                borderRadius: 16,
                border: '1px solid var(--border)',
                boxShadow: 'var(--shadow-sm)'
              }}>
              
                {}
                <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.05 }}
                style={{
                  background: 'var(--bg-secondary)',
                  padding: 14,
                  borderRadius: 10,
                  display: 'flex',
                  alignItems: 'center',
                  gap: 10,
                  border: '1px solid var(--border)'
                }}>
                
                  <Mail size={18} style={{ color: 'var(--accent)', flexShrink: 0 }} />
                  <div>
                    <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', margin: 0 }}>
                      Verification code sent to:
                    </p>
                    <p style={{ fontSize: '0.9rem', color: 'var(--text)', fontWeight: 600, margin: '2px 0 0' }}>
                      {form.email}
                    </p>
                  </div>
                </motion.div>

                {}
                <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.1 }}>
                
                  <label style={{
                  display: 'block',
                  fontSize: '0.8rem',
                  fontWeight: 700,
                  color: 'var(--text-secondary)',
                  marginBottom: 8,
                  textTransform: 'uppercase',
                  letterSpacing: '0.05em'
                }}>
                    6-Digit Code
                  </label>
                  <input
                  type="text"
                  inputMode="numeric"
                  maxLength={6}
                  placeholder="000000"
                  value={otpCode}
                  onChange={(e) => {
                    setOtpCode(e.target.value.replace(/\D/g, '').slice(0, 6));
                    if (otpError) setOtpError('');
                  }}
                  required
                  style={{
                    width: '100%',
                    padding: '14px 12px',
                    border: `1.5px solid ${otpError ? '#ef4444' : 'var(--border)'}`,
                    borderRadius: 12,
                    background: 'var(--bg)',
                    color: 'var(--text)',
                    fontSize: '1.2rem',
                    fontFamily: 'monospace',
                    fontWeight: 700,
                    letterSpacing: '0.5em',
                    transition: 'all 0.2s ease',
                    boxSizing: 'border-box',
                    textAlign: 'center'
                  }}
                  onFocus={(e) => e.target.style.borderColor = otpError ? '#ef4444' : 'var(--accent)'}
                  onBlur={(e) => e.target.style.borderColor = otpError ? '#ef4444' : 'var(--border)'} />
                
                  {otpError &&
                <motion.p
                  initial={{ opacity: 0, y: -5 }}
                  animate={{ opacity: 1, y: 0 }}
                  style={{
                    fontSize: '0.75rem',
                    color: '#ef4444',
                    margin: '6px 0 0',
                    fontWeight: 500
                  }}>
                  
                      ❌ {otpError}
                    </motion.p>
                }
                </motion.div>

                {}
                <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 0.15 }}
                style={{
                  fontSize: '0.8rem',
                  color: 'var(--text-tertiary)',
                  textAlign: 'center'
                }}>
                
                  didn't get the code?
                  <button
                  type="button"
                  disabled={loading}
                  onClick={requestRegisterOtp}
                  style={{
                    marginLeft: 6,
                    background: 'transparent',
                    border: 'none',
                    color: 'var(--accent)',
                    cursor: loading ? 'not-allowed' : 'pointer',
                    fontSize: '0.8rem',
                    fontWeight: 700,
                    padding: 0,
                    textDecoration: 'underline'
                  }}>
                  
                    Resend
                  </button>
                </motion.div>

                {}
                <motion.button
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.2 }}
                whileHover={{ scale: 1.02, y: -2 }}
                whileTap={{ scale: 0.98 }}
                type="submit"
                disabled={loading || otpCode.length < 6}
                style={{
                  width: '100%',
                  padding: '12px 16px',
                  background: loading || otpCode.length < 6 ? 'var(--text-tertiary)' : 'var(--accent)',
                  color: 'white',
                  border: 'none',
                  borderRadius: 10,
                  fontSize: '0.95rem',
                  fontWeight: 700,
                  cursor: loading || otpCode.length < 6 ? 'not-allowed' : 'pointer',
                  transition: 'all 0.2s ease',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: 8,
                  boxShadow: loading ? 'var(--shadow-sm)' : 'var(--shadow-md)',
                  opacity: loading || otpCode.length < 6 ? 0.8 : 1
                }}>
                
                  {loading ?
                <>
                      <Loader2 size={18} style={{ animation: 'spin 1s linear infinite' }} />
                      Verifying...
                    </> :

                <>
                      Verify & Create Account
                      <ArrowRight size={18} />
                    </>
                }
                </motion.button>

                {}
                <motion.button
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 0.25 }}
                type="button"
                onClick={() => {
                  setRegisterOtpSent(false);
                  setOtpCode('');
                  setOtpError('');
                  setOtpAttempts(0);
                }}
                disabled={loading}
                style={{
                  width: '100%',
                  padding: '10px 16px',
                  background: 'var(--bg-secondary)',
                  color: 'var(--text-secondary)',
                  border: '1.5px solid var(--border)',
                  borderRadius: 10,
                  fontSize: '0.9rem',
                  fontWeight: 600,
                  cursor: loading ? 'not-allowed' : 'pointer',
                  transition: 'all 0.2s ease'
                }}>
                
                  ← Back to Registration
                </motion.button>
              </motion.form>
            }
          </AnimatePresence>

          {}
          <motion.p
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.3 }}
            style={{
              textAlign: 'center',
              fontSize: '0.85rem',
              color: 'var(--text-secondary)',
              margin: '20px 0 0'
            }}>
            
            Continue only if you accept our Terms and Services.
          </motion.p>
        </div>
      </motion.div>

      {}
      <AnimatePresence>
        {cropSrc &&
        <ImageCropper
          imageSrc={cropSrc}
          onCancel={() => setCropSrc(null)}
          onCropDone={(blob) => {
            setProfileFile(blob);
            setProfilePreview(URL.createObjectURL(blob));
            setCropSrc(null);
          }} />

        }
      </AnimatePresence>
    </div>);

};

export default AuthPage;