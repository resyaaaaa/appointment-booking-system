/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import {
  Calendar,
  Settings,
  Unlock,
  Lock,
  Clock,
  Scissors,
  Mail,
  CalendarCheck,
  Server,
  LogOut,
  ChevronRight,
  Info,
  ShieldAlert,
  Menu,
  X,
  ArrowRight,
  Sparkles,
  Award
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

// Subcomponents
import WizardBooker from './components/WizardBooker';
import { timeToMinutes, minutesToTime12 } from './utils';
import AdminBookings from './components/AdminBookings';
import AdminAvailability from './components/AdminAvailability';
import AdminServices from './components/AdminServices';
import AdminEmailLogs from './components/AdminEmailLogs';
import AdminStaff from './components/AdminStaff';
import AdminSettings from './components/AdminSettings';
import AdminProfile from './components/AdminProfile';

export default function App() {
  const [showMenuOverlay, setShowMenuOverlay] = useState(false);

  // Navigation Tabs: 'booker' | 'admin'
  const [activePortal, setActivePortal] = useState(() => {
    return localStorage.getItem('biz_active_portal') || 'booker';
  });

  // Admin module tab: 'bookings' | 'staff' | 'settings' | 'availability' | 'services' | 'templates'
  const [adminTab, setAdminTab] = useState(() => {
    return localStorage.getItem('biz_admin_tab') || 'bookings';
  });

  const handleSetActivePortal = (portal) => {
    setActivePortal(portal);
    localStorage.setItem('biz_active_portal', portal);
  };

  const handleSetAdminTab = (tab) => {
    setAdminTab(tab);
    localStorage.setItem('biz_admin_tab', tab);
  };

  // Unified Server State
  const [appointments, setAppointments] = useState([]);
  const [services, setServices] = useState([]);
  const [availability, setAvailability] = useState([]);
  const [customBlocks, setCustomBlocks] = useState([]);
  const [emailTemplates, setEmailTemplates] = useState([]);
  const [emailLogs, setEmailLogs] = useState([]);
  const [staff, setStaff] = useState([]);
  const [settings, setSettings] = useState({});

  const [loadingDb, setLoadingDb] = useState(true);
  const API_URL = import.meta.env.VITE_API_URL || '';

  // User Account Session
  const [currentUser, setCurrentUser] = useState(() => {
    try {
      const saved = localStorage.getItem('biz_profile');
      return saved ? JSON.parse(saved) : null;
    } catch {
      return null;
    }
  });
  const [showAuthModal, setShowAuthModal] = useState(false);
  const [authModalTab, setAuthModalTab] = useState('login');

  // Administrative Passcode Auth States
  const [adminPassword, setAdminPassword] = useState(() => {
    return localStorage.getItem('biz_admin_passwd') || '';
  });
  const [isAuthorized, setIsAuthorized] = useState(() => {
    try {
      const saved = localStorage.getItem('biz_profile');
      if (saved) {
        const parsed = JSON.parse(saved);
        return parsed && (parsed.role === 'owner' || parsed.role === 'staff');
      }
    } catch { }
    return false;
  });
  const [authError, setAuthError] = useState('');
  const [verifying, setVerifying] = useState(false);

  // Sync admin dashboard access if login as staff or owner
  useEffect(() => {
    if (currentUser && (currentUser.role === 'owner' || currentUser.role === 'staff')) {
      setIsAuthorized(true);
      localStorage.setItem('biz_is_authorized', 'true');
    } else {
      setIsAuthorized(false);
      localStorage.removeItem('biz_is_authorized');
    }
  }, [currentUser]);

  // Switch to add appointment wizard within staff mode
  const [staffEntryMode, setStaffEntryMode] = useState(false);

  // Fetch all database lists 
  const fetchAllData = async () => {
    try {
      setLoadingDb(true);

      const [servicesRes, apptsRes, availRes, blocksRes, templatesRes, logsRes, staffRes, settingsRes] = await Promise.all([
        fetch(`${API_URL}/api/services`),
        fetch(`${API_URL}/api/appointments`),
        fetch(`${API_URL}/api/availability`),
        fetch(`${API_URL}/api/custom-blocks`),
        fetch(`${API_URL}/api/email-templates`),
        fetch(`${API_URL}/api/email-logs`),
        fetch(`${API_URL}/api/staff`),
        fetch(`${API_URL}/api/settings`)
      ]);

      const srvs = await servicesRes.json();
      const appts = await apptsRes.json();
      const avail = await availRes.json();
      const blocks = await blocksRes.json();
      const templates = await templatesRes.json();
      const logs = await logsRes.json();
      const stff = await staffRes.json();
      const sett = await settingsRes.json();

      if (Array.isArray(srvs)) setServices(srvs);
      if (Array.isArray(appts)) setAppointments(appts);
      if (Array.isArray(avail)) setAvailability(avail);
      if (Array.isArray(blocks)) setCustomBlocks(blocks);
      if (Array.isArray(templates)) setEmailTemplates(templates);
      if (Array.isArray(logs)) setEmailLogs(logs);
      if (Array.isArray(stff)) setStaff(stff);
      if (sett && typeof sett === 'object') setSettings(sett);

    } catch (err) {
      console.error('Failed to sync master state with server:', err);
    } finally {
      setLoadingDb(false);
    }
  };

  useEffect(() => {
    fetchAllData();
  }, []);

  // Handle staff passcode
  const handleAdminVerify = async (e) => {
    e.preventDefault();
    setVerifying(true);
    setAuthError('');

    try {
      const response = await fetch(`${API_URL}/api/admin/verify`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password: adminPassword })
      });
      const data = await response.json();

      if (response.ok && data.success) {
        setIsAuthorized(true);
        localStorage.setItem('biz_is_authorized', 'true');
        localStorage.setItem('biz_admin_passwd', adminPassword);
        setAuthError('');
        fetchAllData();
      } else {
        setAuthError(data.message || 'Invalid administrative password. Try admin123');
      }
    } catch (err) {
      setAuthError('Authentication route failed on Node.js backend. Is server run?');
    } finally {
      setVerifying(false);
    }
  };

  const handleLogout = () => {
    setIsAuthorized(false);
    setAdminPassword('');
    setCurrentUser(null);
    localStorage.removeItem('biz_is_authorized');
    localStorage.removeItem('biz_admin_passwd');
    localStorage.removeItem('biz_profile');
    setStaffEntryMode(false);
  };

  // Account authentication 
  const [authEmail, setAuthEmail] = useState('');
  const [authPassword, setAuthPassword] = useState('');
  const [authName, setAuthName] = useState('');
  const [authPhone, setAuthPhone] = useState('');
  const [authRole, setAuthRole] = useState('customer'); 
  const [authSecretKey, setAuthSecretKey] = useState('');
  const [authFormError, setAuthFormError] = useState('');
  const [authLoading, setAuthLoading] = useState(false);

  const clearAuthFields = () => {
    setAuthEmail('');
    setAuthPassword('');
    setAuthName('');
    setAuthPhone('');
    setAuthRole('customer');
    setAuthSecretKey('');
    setAuthFormError('');
  };

  const handleUserAuthSubmit = async (e) => {
    e.preventDefault();
    setAuthFormError('');
    setAuthLoading(true);

    try {
      if (authModalTab === 'register') {
        // Validation for Staff / Owner roles
        if (authRole === 'staff' || authRole === 'owner') {
          if (authSecretKey !== 'admin123') {
            setAuthFormError('Invalid security authorization key for employee registrations.');
            setAuthLoading(false);
            return;
          }
        }

        const res = await fetch(`${API_URL}/api/auth/register`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            name: authName,
            email: authEmail,
            password: authPassword,
            role: authRole,
            phone: authPhone
          })
        });

        const data = await res.json();
        if (res.ok && data.success) {
          setCurrentUser(data.user);
          localStorage.setItem('biz_profile', JSON.stringify(data.user));
          if (data.user.role === 'staff' || data.user.role === 'owner') {
            setAdminPassword(authPassword);
            localStorage.setItem('biz_admin_passwd', authPassword);
          }
          setShowAuthModal(false);
          clearAuthFields();
          fetchAllData();
        } else {
          setAuthFormError(data.error || 'Registration failed. Check your inputs.');
        }
      } else {
        // Login Workflow
        const res = await fetch(`${API_URL}/api/auth/login`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            email: authEmail,
            password: authPassword
          })
        });

        const data = await res.json();
        if (res.ok && data.success) {
          setCurrentUser(data.user);
          localStorage.setItem('biz_profile', JSON.stringify(data.user));
          if (data.user.role === 'staff' || data.user.role === 'owner') {
            setAdminPassword(authPassword);
            localStorage.setItem('biz_admin_passwd', authPassword);
          }
          setShowAuthModal(false);
          clearAuthFields();
          fetchAllData();
        } else {
          setAuthFormError(data.error || 'Invalid credentials.');
        }
      }
    } catch (err) {
      setAuthFormError('Unable to connect to authentication server endpoint.');
    } finally {
      setAuthLoading(false);
    }
  };

  // State Updates from subcomponents
  const handleBookingAdded = (newAppt) => {
    setAppointments(prev => [newAppt, ...prev]);
    // Refresh templates logs since newly booked triggers an automated confirmation email!
    fetch(`${API_URL}/api/email-logs`)
      .then(r => r.json())
      .then(logs => {
        if (Array.isArray(logs)) setEmailLogs(logs);
      });

    if (staffEntryMode) {
      setStaffEntryMode(false);
      handleSetAdminTab('bookings');
    }
  };

  const handleBookingDeleted = (idOrIds) => {
    setAppointments(prev => {
      if (Array.isArray(idOrIds)) {
        const idsSet = new Set(idOrIds);
        return prev.filter(a => !idsSet.has(a.id));
      }
      return prev.filter(a => a.id !== idOrIds);
    });
    // Pull email logs down to sync cancelled automated alerts
    fetch(`${API_URL}/api/email-logs`)
      .then(r => r.json())
      .then(logs => {
        if (Array.isArray(logs)) setEmailLogs(logs);
      });
  };

  const handleBookingUpdated = (updatedAppt) => {
    setAppointments(prev => prev.map(a => a.id === updatedAppt.id ? updatedAppt : a));
    // Re-pull email logs
    fetch(`${API_URL}/api/email-logs`)
      .then(r => r.json())
      .then(logs => {
        if (Array.isArray(logs)) setEmailLogs(logs);
      });
  };

  const handleServiceUpdatedOrCreated = (srv) => {
    setServices(prev => {
      const idx = prev.findIndex(s => s.id === srv.id);
      if (idx >= 0) {
        const copy = [...prev];
        copy[idx] = srv;
        return copy;
      }
      return [...prev, srv];
    });
  };

  const handleServiceDeleted = (id) => {
    setServices(prev => prev.filter(s => s.id !== id));
  };

  return (
    <div className="min-h-screen flex flex-col font-sans selection:bg-[#3a4f99] selection:text-white relative overflow-hidden bg-white">
      <header className="bg-white/70 backdrop-blur-md border-b border-[#D8E022] sticky top-0 z-30 shadow-[0_1px_5px_rgba(216,224,34,0.05)] transition-all">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between gap-4 relative z-10">

          {/* Business Label & Logo */}
          <div className="flex items-center gap-3 group">

            <div>
              <h1 className="font-display font-bold text-slate-900 text-sm tracking-tight sm:text-base leading-none flex items-center gap-1.5">
                <span className="tracking-tight text-slate-900">
                  {(settings.businessName || 'My business Name').toUpperCase()}
                </span>

              </h1>
              <span className="text-[9px] text-slate-600 uppercase font-extrabold tracking-widest mt-0.5 block">Appointment Booking System</span>
            </div>
          </div>


          {/* Core Portal Navigation & Launcher */}
          <div className="flex items-center gap-2">
            <div className="flex items-center gap-1.5 sm:gap-2 bg-slate-150/40 p-1 rounded-xl border border-slate-200/20">
              <button
                id="nav-to-booker-btn"
                onClick={() => { handleSetActivePortal('booker'); setStaffEntryMode(false); }}
                className={`px-4.5 py-2 rounded-lg text-xs font-extrabold tracking-wide transition-all duration-300 hover:scale-[1.03] active:scale-[0.97] cursor-pointer ${activePortal === 'booker'
                  ? 'bg-primary text-slate-950 shadow-md shadow-primary/10 font-black border border-[#D8E022]'
                  : 'text-slate-700 hover:text-slate-900 hover:bg-[#D8E022]/15 font-bold'
                  }`}
              >
                Book Slot
              </button>
              <button
                id="nav-to-admin-btn"
                onClick={() => handleSetActivePortal('admin')}
                className={`px-4.5 py-2 rounded-lg text-xs font-extrabold tracking-wide transition-all duration-300 hover:scale-[1.03] active:scale-[0.97] flex items-center gap-1.5 cursor-pointer ${activePortal === 'admin'
                  ? 'bg-primary text-slate-950 shadow-md shadow-primary/10 font-black border border-[#D8E022]'
                  : 'text-slate-700 hover:text-slate-900 hover:bg-[#D8E022]/15 font-bold'
                  }`}
              >
                <span>Dashboard</span>
                {isAuthorized ? (
                  <Unlock className="w-3.5 h-3.5 text-emerald-800 animate-pulse" />
                ) : (
                  <Lock className="w-3.5 h-3.5 text-slate-500" />
                )}
              </button>

              {/* Auth Session Button / Profile widget */}
              {currentUser && (
                <div className="flex items-center gap-2 pl-2 border-l border-[#D8E022] ml-1">
                  <div className="hidden sm:flex flex-col text-right select-none">
                    <span className="text-[11px] font-bold text-slate-950 leading-none truncate max-w-25">{currentUser.name}</span>
                    <span className="text-[8px] font-extrabold text-slate-900 bg-[#D8E022] uppercase tracking-widest font-mono mt-0.5 px-1 rounded">{currentUser.role === 'owner' ? 'Owner' : 'Staff'}</span>
                  </div>
                  <button
                    onClick={handleLogout}
                    className="p-1.5 hover:bg-rose-50 text-slate-500 hover:text-rose-600 rounded-lg transition-all duration-300 hover:scale-110"
                    title="Sign Out / Log Out"
                  >
                    <LogOut className="w-4 h-4" />
                  </button>
                </div>
              )}
            </div>
          </div>

        </div>
      </header>

      {/* PORTAL MOUNTING STAGES */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-8 relative z-10">

        {loadingDb && (
          <div className="text-center py-6 text-xs font-medium text-slate-500 bg-white border border-slate-100 rounded-xl mb-4 animate-pulse">
            Loading schedules and calendar configurations. Please wait...
          </div>
        )}

        {/* PORTAL A: CUSTOMER BOOKER WIZARD */}
        {activePortal === 'booker' && (
          <div className="space-y-6">
            <div className="bg-white rounded-2xl border border-slate-200 p-6 max-w-3xl mx-auto shadow-sm">
              {/* Dynamic Operational Hours Panel */}
              <div className="flex flex-col gap-3">
                <div className="flex items-center gap-2 border-b border-slate-150 pb-2.5">
                  <Clock className="w-4 h-4 text-[#D8E022]" />
                  <span className="font-display font-bold text-xs uppercase tracking-wider text-slate-700">
                    Operational Hours Schedule
                  </span>
                </div>

                <div className="grid gap-3 sm:grid-cols-2 md:grid-cols-3 pt-1">
                  {(() => {
                    if (!availability || availability.length === 0) {
                      return <span className="text-xs text-slate-400 animate-pulse col-span-full">Loading dynamic schedule...</span>;
                    }

                    const dayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
                    const sortedRules = [...availability].sort((a, b) => a.dayOfWeek - b.dayOfWeek);
                    const summarizedRows = [];
                    let currentGroup = null;

                    sortedRules.forEach((rule) => {
                      const setupKey = rule.isWorkingDay
                        ? `${rule.startTime}-${rule.endTime}-${rule.breakTimeStart || ''}-${rule.breakTimeEnd || ''}`
                        : 'Closed';

                      if (!currentGroup) {
                        currentGroup = {
                          startDay: rule.dayOfWeek,
                          endDay: rule.dayOfWeek,
                          setupKey,
                          isWorkingDay: rule.isWorkingDay,
                          startTime: rule.startTime,
                          endTime: rule.endTime
                        };
                      } else if (currentGroup.setupKey === setupKey) {
                        currentGroup.endDay = rule.dayOfWeek;
                      } else {
                        summarizedRows.push(currentGroup);
                        currentGroup = {
                          startDay: rule.dayOfWeek,
                          endDay: rule.dayOfWeek,
                          setupKey,
                          isWorkingDay: rule.isWorkingDay,
                          startTime: rule.startTime,
                          endTime: rule.endTime
                        };
                      }
                    });
                    if (currentGroup) {
                      summarizedRows.push(currentGroup);
                    }

                    const formatTimeLabel = (timeStr) => {
                      if (!timeStr) return '';
                      const parts = timeStr.split(':');
                      if (parts.length < 2) return timeStr;
                      let h = parseInt(parts[0], 10);
                      const m = parseInt(parts[1], 10);
                      const ampm = h >= 12 ? 'pm' : 'am';
                      h = h % 12;
                      if (h === 0) h = 12;
                      const mStr = m === 0 ? '' : `:${String(m).padStart(2, '0')}`;
                      return `${h}${mStr}${ampm}`;
                    };

                    return summarizedRows.map((row, idx) => {
                      let dayLabel = '';
                      if (row.startDay === row.endDay) {
                        dayLabel = dayNames[row.startDay];
                      } else if (row.endDay - row.startDay === 1) {
                        dayLabel = `${dayNames[row.startDay].slice(0, 3)}, ${dayNames[row.endDay].slice(0, 3)}`;
                      } else {
                        dayLabel = `${dayNames[row.startDay].slice(0, 3)} - ${dayNames[row.endDay].slice(0, 3)}`;
                      }

                      return (
                        <div key={idx} className="bg-slate-50 border border-slate-100 p-2.5 rounded-xl flex flex-col justify-center gap-1">
                          <span className="font-extrabold text-[9.5px] text-slate-400 uppercase tracking-widest block font-mono">{dayLabel}</span>
                          {row.isWorkingDay ? (
                            <span className="font-bold text-slate-700 text-xs">{formatTimeLabel(row.startTime)} - {formatTimeLabel(row.endTime)}</span>
                          ) : (
                            <span className="text-[10px] font-extrabold text-rose-600 bg-rose-50/50 border border-rose-100/50 px-2 py-0.5 rounded-lg w-max uppercase tracking-wider">Closed</span>
                          )}
                        </div>
                      );
                    });
                  })()}
                </div>
              </div>
            </div>

            <WizardBooker
              services={services}
              appointments={appointments}
              availability={availability}
              customBlocks={customBlocks}
              onBookingComplete={handleBookingAdded}
              currentUser={currentUser}
              staff={staff}
              settings={settings}
            />
          </div>
        )}

        {/* PORTAL B: ADMINISTRATOR DASHBOARD */}
        {activePortal === 'admin' && (
          <div className="space-y-6">

            {/* Case: Not authorized. Display login/register form. */}
            {!isAuthorized ? (
              currentUser && currentUser.role === 'customer' ? (
                <div className="max-w-md mx-auto bg-white rounded-2xl border border-slate-200 p-8 shadow-xl text-center space-y-5 py-12 animate-fade-in text-slate-700">
                  <div className="w-16 h-16 bg-rose-50 text-rose-500 rounded-full flex items-center justify-center mx-auto border border-rose-100 mb-2">
                    <ShieldAlert size={32} />
                  </div>
                  <h3 className="font-display font-bold text-slate-800 text-lg tracking-tight">Access Restricted</h3>
                  <p className="text-xs text-slate-500 leading-relaxed">
                    You are currently logged in with a Customer profile (<strong>{currentUser.email}</strong>). The Staff Dashboard is exclusive to salon employee and administrator accounts.
                  </p>
                  <div className="pt-2">
                    <button
                      onClick={handleLogout}
                      className="w-full bg-rose-600 hover:bg-rose-700 text-white font-semibold text-xs py-3 rounded-xl transition shadow-md shadow-rose-200"
                    >
                      Sign Out of Customer Account
                    </button>
                  </div>
                </div>
              ) : (
                <div className="max-w-md mx-auto bg-white rounded-2xl border border-slate-200 p-6 sm:p-8 shadow-xl space-y-6 text-slate-750 animate-fade-in">
                  <div className="text-center space-y-2">
                    <div className="w-12 h-12 bg-primary/10 text-primary rounded-full flex items-center justify-center mx-auto border border-primary/20">
                      <Lock className="w-5 h-5" />
                    </div>
                    <h3 className="font-display font-bold text-slate-900 text-lg tracking-tight">Staff Workspace Gate</h3>
                    <p className="text-xs text-slate-500 leading-relaxed max-w-sm mx-auto">
                      Log in to your employee or administrator account to manage availability, customize service packages, and track logs.
                    </p>
                  </div>

                  {/* Interactive toggle tabs */}
                  <div className="flex bg-slate-100 p-1 rounded-xl gap-1">
                    <button
                      type="button"
                      onClick={() => { setAuthModalTab('login'); setAuthFormError(''); }}
                      className={`flex-1 text-center py-2.5 text-xs font-bold rounded-lg transition-all duration-150 ${authModalTab === 'login' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-700'
                        }`}
                    >
                      Employee Sign-In
                    </button>
                    <button
                      type="button"
                      onClick={() => { setAuthModalTab('register'); setAuthFormError(''); setAuthRole('staff'); }}
                      className={`flex-1 text-center py-2.5 text-xs font-bold rounded-lg transition-all duration-150 ${authModalTab === 'register' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-700'
                        }`}
                    >
                      Register Staff Profile
                    </button>
                  </div>

                  {authFormError && (
                    <div className="bg-rose-50 text-rose-850 text-xs font-semibold p-3.5 rounded-xl border border-rose-100 leading-normal animate-fade-in">
                      {authFormError}
                    </div>
                  )}

                  <form onSubmit={handleUserAuthSubmit} className="space-y-4 text-xs">
                    {authModalTab === 'register' && (
                      <div className="space-y-4 animate-fade-in">
                        <div className="space-y-1">
                          <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider">Full Name</label>
                          <input
                            type="text"
                            required
                            value={authName}
                            onChange={(e) => setAuthName(e.target.value)}
                            placeholder="Sarah Connor"
                            className="w-full text-xs p-3 bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:outline-none focus:border-primary transition"
                          />
                        </div>

                        <div className="space-y-1">
                          <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider">Contact Number</label>
                          <input
                            type="tel"
                            value={authPhone}
                            onChange={(e) => setAuthPhone(e.target.value)}
                            placeholder="012-3456789"
                            className="w-full text-xs p-3 bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:outline-none focus:border-primary transition"
                          />
                        </div>
                      </div>
                    )}

                    <div className="space-y-1">
                      <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider">Email Address</label>
                      <input
                        type="email"
                        required
                        value={authEmail}
                        onChange={(e) => setAuthEmail(e.target.value)}
                        placeholder="employee@salon.com"
                        className="w-full text-xs p-3 bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:outline-none focus:border-primary transition"
                      />
                    </div>

                    <div className="space-y-1">
                      <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider">Password</label>
                      <input
                        type="password"
                        required
                        value={authPassword}
                        onChange={(e) => setAuthPassword(e.target.value)}
                        placeholder="••••••••"
                        className="w-full text-xs p-3 bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:outline-none focus:border-primary transition"
                      />
                    </div>

                    {authModalTab === 'register' && (
                      <div className="space-y-4 animate-fade-in">
                        <div className="space-y-1">
                          <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider">Roster Rank / System Role</label>
                          <select
                            value={authRole}
                            onChange={(e) => setAuthRole(e.target.value)}
                            className="w-full text-xs p-3 bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:outline-none focus:border-primary transition"
                          >
                            <option value="staff">Staff Stylist / Technician</option>
                            <option value="owner">Admin Salon Owner</option>
                          </select>
                        </div>

                        <div className="space-y-1 p-3 bg-slate-50 rounded-xl border border-slate-200">
                          <label className="block text-[9.5px] font-bold text-[#3a4f99] uppercase tracking-wider">Staff Verification Passcode</label>
                          <input
                            type="password"
                            required
                            value={authSecretKey}
                            onChange={(e) => setAuthSecretKey(e.target.value)}
                            placeholder="Passcode (default admin123)"
                            className="w-full text-xs p-2.5 bg-white border border-slate-150 rounded-lg focus:outline-none focus:border-[#3a4f99] transition mt-1"
                          />
                          <span className="text-[9px] text-[#3a4f99]/85 mt-1 block font-medium">Please specify the general salon authorization passcode.</span>
                        </div>
                      </div>
                    )}

                    <button
                      type="submit"
                      disabled={authLoading}
                      className="w-full bg-primary hover:bg-primary/95 text-white py-3 rounded-xl font-bold text-xs transition shadow-md shadow-primary/10 mt-2"
                    >
                      {authLoading ? 'Verifying identity, loading workspace...' : authModalTab === 'login' ? 'Authenticate Stylist Session' : 'Create Staff Profile'}
                    </button>
                  </form>
                </div>
              )
            ) : (
              /* Case: Secure Admin Area */
              <div className="space-y-6 animate-fade-in">
                {/* Inside Staff Entry Wizard Mode (when they switch to booking a client directly) */}
                {staffEntryMode ? (
                  <div className="space-y-4">
                    <button
                      onClick={() => setStaffEntryMode(false)}
                      className="text-xs font-semibold text-slate-500 hover:text-slate-800 flex items-center gap-1 mb-2"
                    >
                      ← Dismiss Booker Wizard &amp; Back to Active Logs
                    </button>

                    <div className="bg-emerald-50 text-emerald-800 text-xs p-3 rounded-xl border border-emerald-100 flex items-center gap-2">
                      <CalendarCheck className="w-4 h-4 text-emerald-600" />
                      <span><strong>Administrative booking override:</strong> Staff are registering a customer directly on the live database.</span>
                    </div>

                    <WizardBooker
                      services={services}
                      appointments={appointments}
                      availability={availability}
                      customBlocks={customBlocks}
                      onBookingComplete={handleBookingAdded}
                      currentUser={currentUser}
                      staffMode={true}
                      staff={staff}
                      settings={settings}
                    />
                  </div>
                ) : (
                  /* Standard Admin Dashboard Modular Views */
                  <div className="space-y-6">
                    {/* Switch Modules Tab bar */}
                    <div className="flex gap-1.5 border-b border-slate-200 overflow-x-auto pb-px">
                      <button
                        onClick={() => handleSetAdminTab('profile')}
                        className={`px-4 py-2.5 text-xs font-semibold whitespace-nowrap tracking-wide transition-all border-b-2 ${adminTab === 'profile'
                          ? 'border-primary text-primary font-bold'
                          : 'border-transparent text-slate-500 hover:text-slate-800'
                          }`}
                      >
                        My Profile
                      </button>

                      <button
                        onClick={() => handleSetAdminTab('bookings')}
                        className={`px-4 py-2.5 text-xs font-semibold whitespace-nowrap tracking-wide transition-all border-b-2 ${adminTab === 'bookings'
                          ? 'border-primary text-primary font-bold'
                          : 'border-transparent text-slate-500 hover:text-slate-800'
                          }`}
                      >
                        Bookings List ({appointments.length})
                      </button>

                      <button
                        onClick={() => handleSetAdminTab('staff')}
                        className={`px-4 py-2.5 text-xs font-semibold whitespace-nowrap tracking-wide transition-all border-b-2 ${adminTab === 'staff'
                          ? 'border-primary text-primary font-bold'
                          : 'border-transparent text-slate-500 hover:text-slate-800'
                          }`}
                      >
                        Staff Directory ({staff.length})
                      </button>

                      <button
                        onClick={() => handleSetAdminTab('settings')}
                        className={`px-4 py-2.5 text-xs font-semibold whitespace-nowrap tracking-wide transition-all border-b-2 ${adminTab === 'settings'
                          ? 'border-primary text-primary font-bold'
                          : 'border-transparent text-slate-500 hover:text-slate-800'
                          }`}
                      >
                        Business Profile settings
                      </button>

                      <button
                        onClick={() => handleSetAdminTab('availability')}
                        className={`px-4 py-2.5 text-xs font-semibold whitespace-nowrap tracking-wide transition-all border-b-2 ${adminTab === 'availability'
                          ? 'border-primary text-primary font-bold'
                          : 'border-transparent text-slate-500 hover:text-slate-800'
                          }`}
                      >
                        Operational Hours &amp; Holds
                      </button>

                      <button
                        onClick={() => handleSetAdminTab('services')}
                        className={`px-4 py-2.5 text-xs font-semibold whitespace-nowrap tracking-wide transition-all border-b-2 ${adminTab === 'services'
                          ? 'border-primary text-primary font-bold'
                          : 'border-transparent text-slate-500 hover:text-slate-800'
                          }`}
                      >
                        Services Catalog ({services.length})
                      </button>

                      <button
                        onClick={() => handleSetAdminTab('templates')}
                        className={`px-4 py-2.5 text-xs font-semibold whitespace-nowrap tracking-wide transition-all border-b-2 ${adminTab === 'templates'
                          ? 'border-primary text-primary font-bold'
                          : 'border-transparent text-slate-500 hover:text-slate-800'
                          }`}
                      >
                        Templates &amp; Communications
                      </button>


                    </div>

                    {/* MOUNT ACTIVE TAB WORKFLOW */}
                    {adminTab === 'profile' && (
                      <AdminProfile
                        currentUser={currentUser}
                        staff={staff}
                        onProfileUpdated={(updatedUser) => {
                          setCurrentUser(updatedUser);
                          localStorage.setItem('biz_profile', JSON.stringify(updatedUser));
                        }}
                        onRefreshData={fetchAllData}
                      />
                    )}

                    {adminTab === 'bookings' && (
                      <AdminBookings
                        appointments={appointments}
                        services={services}
                        emailTemplates={emailTemplates}
                        onBookingDeleted={handleBookingDeleted}
                        onBookingUpdated={handleBookingUpdated}
                        onAddBookingClick={() => setStaffEntryMode(true)}
                        staff={staff}
                        settings={settings}
                        adminPassword={adminPassword}
                      />
                    )}

                    {adminTab === 'staff' && (
                      <AdminStaff
                        staff={staff}
                        adminPassword={adminPassword}
                        onStaffUpdatedOrCreated={(member) => {
                          setStaff(prev => {
                            const idx = prev.findIndex(m => m.id === member.id);
                            if (idx >= 0) {
                              const copy = [...prev];
                              copy[idx] = member;
                              return copy;
                            }
                            return [...prev, member];
                          });
                        }}
                        onStaffDeleted={(id) => {
                          setStaff(prev => prev.filter(m => m.id !== id));
                        }}
                      />
                    )}

                    {adminTab === 'settings' && (
                      <AdminSettings
                        settings={settings}
                        adminPassword={adminPassword}
                        onSettingsUpdated={(newSettings) => {
                          setSettings(newSettings);
                        }}
                      />
                    )}

                    {adminTab === 'availability' && (
                      <AdminAvailability
                        availability={availability}
                        customBlocks={customBlocks}
                        adminPassword={adminPassword}
                        onAvailabilityUpdated={(cfg) => setAvailability(cfg)}
                        onCustomBlocksUpdated={(blks) => setCustomBlocks(blks)}
                      />
                    )}

                    {adminTab === 'services' && (
                      <AdminServices
                        services={services}
                        adminPassword={adminPassword}
                        onServiceCreatedOrUpdated={handleServiceUpdatedOrCreated}
                        onServiceDeleted={handleServiceDeleted}
                      />
                    )}

                    {adminTab === 'templates' && (
                      <AdminEmailLogs
                        emailTemplates={emailTemplates}
                        adminPassword={adminPassword}
                        onTemplateUpdated={(tpl) => {
                          setEmailTemplates(prev => prev.map(t => t.id === tpl.id ? tpl : t));
                        }}
                      />
                    )}


                  </div>
                )}

              </div>
            )}

          </div>
        )}

      </main>

      {/* FOOTER */}
      <footer className="bg-transparent border-t border-slate-300/40 py-8 text-center text-slate-700 font-medium text-xs mt-auto">
        <div className="max-w-7xl mx-auto px-4">
          <p>© 2026 {settings.businessName || 'My business Name'}</p>
        </div>
      </footer>
    </div>
  );
}
