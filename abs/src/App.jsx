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
  Mail, 
  CalendarCheck, 
  Server, 
  LogOut,
  ChevronRight,
  Info,
  MapPinIcon
} from 'lucide-react';

// Subcomponents
import WizardBooker from './components/WizardBooker';
import { timeToMinutes, minutesToTime12 } from './utils';
import AdminBookings from './components/AdminBookings';
import AdminAvailability from './components/AdminAvailability';
import AdminServices from './components/AdminServices';
import AdminEmailLogs from './components/AdminEmailLogs';
import AdminStaff from './components/AdminStaff';
import AdminSettings from './components/AdminSettings';
import AdminMySqlConfig from './components/AdminMySqlConfig';

export default function App() {
  // Navigation Tabs: 'booker' | 'admin'
  const [activePortal, setActivePortal] = useState('booker');
  
  // Admin module tab: 'bookings' | 'staff' | 'settings' | 'availability' | 'services' | 'templates'
  const [adminTab, setAdminTab] = useState('bookings');

  // Unified Server State
  const [appointments, setAppointments] = useState([]);
  const [services, setServices] = useState([]);
  const [availability, setAvailability] = useState([]);
  const [customBlocks, setCustomBlocks] = useState([]);
  const [emailTemplates, setEmailTemplates] = useState([]);
  const [staff, setStaff] = useState([]);
  const [settings, setSettings] = useState({});
  
  const [loadingDb, setLoadingDb] = useState(true);

  // Administrative Passcode Auth States - persistent in localStorage to prevent rapid re-logs
  const [adminPassword, setAdminPassword] = useState(() => {
    return localStorage.getItem('admin_passwd') || '';
  });
  const [isAuthorized, setIsAuthorized] = useState(() => {
    return localStorage.getItem('is_authorized') === 'true';
  });
  const [authError, setAuthError] = useState('');
  const [verifying, setVerifying] = useState(false);

  // Switch to add appointment wizard within staff mode
  const [staffEntryMode, setStaffEntryMode] = useState(false);

  // Fetch all database lists from server API unified (Fixed: Removed /api/email-logs request map)
  const fetchAllData = async () => {
    try {
      setLoadingDb(true);
      
      const [servicesRes, apptsRes, availRes, blocksRes, templatesRes, staffRes, settingsRes] = await Promise.all([
        fetch('/api/services'),
        fetch('/api/appointments'),
        fetch('/api/availability'),
        fetch('/api/custom-blocks'),
        fetch('/api/email-templates'),
        fetch('/api/staff'),
        fetch('/api/settings')
      ]);

      const srvs = await servicesRes.json();
      const appts = await apptsRes.json();
      const avail = await availRes.json();
      const blocks = await blocksRes.json();
      const templates = await templatesRes.json();
      const stff = await staffRes.json();
      const sett = await settingsRes.json();

      if (Array.isArray(srvs)) setServices(srvs);
      if (Array.isArray(appts)) setAppointments(appts);
      if (Array.isArray(avail)) setAvailability(avail);
      if (Array.isArray(blocks)) setCustomBlocks(blocks);
      if (Array.isArray(templates)) setEmailTemplates(templates);
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

  // Handle staff passcode auth submission
  const handleAdminVerify = async (e) => {
    e.preventDefault();
    setVerifying(true);
    setAuthError('');

    try {
      const response = await fetch('/api/admin/verify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password: adminPassword })
      });
      const data = await response.json();

      if (response.ok && data.success) {
        setIsAuthorized(true);
        localStorage.setItem('is_authorized', 'true');
        localStorage.setItem('admin_passwd', adminPassword);
        setAuthError('');
        fetchAllData();
      } else {
        setAuthError(data.message || 'Invalid administrative password. Try admin123');
      }
    } catch (err) {
      setAuthError('Authentication route failed on Node.js backend. Is server running?');
    } finally {
      setVerifying(false);
    }
  };

  const handleLogout = () => {
    setIsAuthorized(false);
    setAdminPassword('');
    localStorage.removeItem('is_authorized');
    localStorage.removeItem('admin_passwd');
    setStaffEntryMode(false);
  };

  // State Updates from subcomponents
  const handleBookingAdded = (newAppt) => {
    setAppointments(prev => [newAppt, ...prev]);
    if (staffEntryMode) {
      setStaffEntryMode(false);
      setAdminTab('bookings');
    }
  };

  const handleBookingDeleted = (id) => {
    setAppointments(prev => prev.filter(a => a.id !== id));
  };

  const handleBookingUpdated = (updatedAppt) => {
    setAppointments(prev => prev.map(a => a.id === updatedAppt.id ? updatedAppt : a));
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
    <div className="min-h-screen bg-slate-50/50 flex flex-col font-sans selection:bg-primary selection:text-white">
      {/* GLOBAL MAIN BRANDING HEADER */}
      <header className="bg-white border-b border-slate-200 sticky top-0 z-30 shadow-[0_1px_3px_rgba(0,0,0,0.02)]">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between gap-4">
          
          {/* Business Label & Logo */}
          <div className="flex items-center gap-3">
            {/* Fixed: Adjusted w-5 h-5 standard sizing specs to prevent layout distortion */}
            <div className="w-9 h-9 bg-primary rounded-lg flex items-center justify-center text-white shrink-0 shadow-md shadow-primary/10">
              <MapPinIcon className="w-5 h-5" />
            </div>
            <div>
              <h1 className="font-display font-bold text-slate-900 text-sm tracking-tight sm:text-base leading-none flex items-center gap-1.5">
                <span>{(settings.businessName || 'My Business Name').toUpperCase()}</span>
              </h1>
              <span className="text-[10px] text-slate-400 uppercase font-bold tracking-wider">Appointment Booking system</span>
            </div>
          </div>

          {/* Core Portal Navigation */}
          <div className="flex items-center gap-1.5 sm:gap-2">
            <button
              id="nav-to-booker-btn"
              onClick={() => { setActivePortal('booker'); setStaffEntryMode(false); }}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold tracking-wide transition-all duration-150 ${
                activePortal === 'booker'
                  ? 'bg-primary text-white shadow-md shadow-primary/10 hover:bg-primary/90'
                  : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
              }`}
            >
              Book Appointment
            </button>
            <button
              id="nav-to-admin-btn"
              onClick={() => setActivePortal('admin')}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold tracking-wide transition-all duration-150 flex items-center gap-1.5 ${
                activePortal === 'admin'
                  ? 'bg-primary text-white shadow-md shadow-primary/10 hover:bg-primary/90'
                  : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
              }`}
            >
              <span>Staff Dashboard</span>
              {isAuthorized ? (
                <Unlock className="w-3.5 h-3.5 text-emerald-400" />
              ) : (
                <Lock className="w-3.5 h-3.5 text-slate-400" />
              )}
            </button>
          </div>

        </div>
      </header>

      {/* PORTAL MOUNTING STAGES */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-8">
        
        {loadingDb && (
          <div className="text-center py-6 text-xs font-medium text-slate-500 bg-white border border-slate-100 rounded-xl mb-4 animate-pulse">
            Loading schedules and calendar configurations. Please wait...
          </div>
        )}

        {/* PORTAL A: CUSTOMER BOOKER WIZARD */}
        {activePortal === 'booker' && (
          <div className="space-y-6">
            <div className="bg-white rounded-2xl border border-slate-200 p-6 flex flex-col md:flex-row items-center justify-between gap-6 max-w-3xl mx-auto shadow-sm">
              <div className="space-y-2 text-center md:text-left">
                <span className="text-[10px] inline-block font-bold uppercase tracking-widest text-primary bg-secondary/35 border border-secondary px-2.5 py-0.5 rounded">
                  Appointment Slots
                </span>
                <p className="text-slate-550 text-xs sm:text-sm max-w-md leading-relaxed">
                  Select your service from our expert directory below and lock in a convenient timeslot instantly.
                </p>
              </div>
              
              <div className="flex flex-col gap-1 text-[11.5px] text-slate-700 shrink-0 bg-slate-50 p-4 rounded-xl border border-slate-200 w-full md:w-64 shadow-sm">
                <div className="flex items-center gap-1.5 font-bold text-[10.5px] uppercase tracking-wide text-slate-400 border-b border-slate-200 pb-1.5 mb-1">
                  <Clock className="w-4 h-4 text-slate-500 animate-pulse" />
                  <span>Operational Hours</span>
                </div>
                {(() => {
                  if (!availability || availability.length === 0) {
                    return <span className="text-[10px] text-slate-400 animate-pulse">Loading hours...</span>;
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
                      dayLabel = dayNames[row.startDay].slice(0, 3);
                    } else if (row.endDay - row.startDay === 1) {
                      dayLabel = `${dayNames[row.startDay].slice(0, 3)}, ${dayNames[row.endDay].slice(0, 3)}`;
                    } else {
                      dayLabel = `${dayNames[row.startDay].slice(0, 3)} - ${dayNames[row.endDay].slice(0, 3)}`;
                    }
                    
                    return (
                      <div key={idx} className="flex justify-between items-center gap-4 py-0.5 text-xs">
                        <span className="font-semibold text-slate-800">{dayLabel}:</span>
                        {row.isWorkingDay ? (
                          <span className="font-bold text-slate-700">{formatTimeLabel(row.startTime)} - {formatTimeLabel(row.endTime)}</span>
                        ) : (
                          <span className="text-[10px] font-bold text-rose-600 bg-rose-50 px-1.5 py-0.2 rounded border border-rose-100">Closed</span>
                        )}
                      </div>
                    );
                  });
                })()}
              </div>
            </div>

            <WizardBooker
              services={services}
              appointments={appointments}
              availability={availability}
              customBlocks={customBlocks}
              onBookingComplete={handleBookingAdded}
              staff={staff}
              settings={settings}
            />
          </div>
        )}

        {/* PORTAL B: ADMINISTRATOR DASHBOARD */}
        {activePortal === 'admin' && (
          <div className="space-y-6">
            
            {!isAuthorized ? (
              <div className="max-w-md mx-auto bg-white rounded-2xl border border-slate-200 p-6 shadow-xl shadow-slate-100/40 space-y-6 py-10">
                <div className="text-center space-y-2">
                  <div className="w-14 h-14 bg-secondary/30 text-primary rounded-full flex items-center justify-center mx-auto border border-secondary mb-3">
                    <Lock className="w-6 h-6" />
                  </div>
                  <h3 className="font-display font-bold text-slate-900 text-lg tracking-tight">Staff Administrator Portal</h3>
                  <p className="text-xs text-slate-500 leading-relaxed">
                    Authorized business staff access panel to manage service menus, change operational hours/breaks, customize email notification templates, and trigger automatic reminders first-hand.
                  </p>
                </div>

                {authError && (
                  <div className="bg-rose-50 text-rose-800 text-xs font-semibold p-3.5 rounded-lg border-l-4 border-rose-500">
                    {authError}
                  </div>
                )}

                <form onSubmit={handleAdminVerify} className="space-y-4 text-xs">
                  <div>
                    <label className="block text-slate-700 font-semibold mb-1.5 uppercase tracking-wide text-[10px]">Enter Staff Access Passcode</label>
                    <input
                      id="admin-passcode-inp"
                      type="password"
                      required
                      placeholder="e.g. admin123"
                      value={adminPassword}
                      onChange={(e) => setAdminPassword(e.target.value)}
                      className="w-full text-xs p-3 bg-slate-50 border border-slate-250 rounded-xl focus:outline-none focus:border-primary focus:bg-white transition"
                    />
                  </div>

                  <button
                    id="admin-auth-submit-btn"
                    type="submit"
                    disabled={verifying}
                    className="w-full bg-primary border border-primary text-white hover:bg-primary/95 py-3 rounded-xl font-semibold transition shadow-md shadow-primary/10"
                  >
                    {verifying ? 'Unlocking Workspace Security...' : 'Unlock Administrative Dashboard'}
                  </button>
                </form>

                <div className="flex gap-2 bg-amber-50 text-amber-800 p-3 rounded-xl border border-amber-100 text-[10.5px]">
                  <Info className="w-4 h-4 shrink-0 text-amber-600 mt-0.5" />
                  <p>
                    <strong>Security Notice:</strong> The default access passcode is set to <strong>admin123</strong>. You can change this anytime by specifying the <code>ADMIN_PASSWORD</code> variable in your configuration secrets.
                  </p>
                </div>
              </div>
            ) : (
              /* Case: Secure Admin Area */
              <div className="space-y-6 animate-fade-in">
                
                <div className="bg-white rounded-xl border border-slate-100 p-4 flex justify-between items-center flex-wrap gap-4">
                  <div className="flex items-center gap-3">
                    <span className="w-2.5 h-2.5 bg-emerald-500 rounded-full animate-pulse" title="System Authorized"></span>
                    <div>
                      <h3 className="font-bold text-slate-800 text-sm">System Management Desk</h3>
                      <p className="text-[10px] text-slate-500 mt-0.5">Secure staff context panel</p>
                    </div>
                  </div>

                  <div className="flex items-center gap-1.5">
                    <button
                      id="staff-logout-btn"
                      onClick={handleLogout}
                      className="p-1 px-2.5 bg-rose-50 hover:bg-rose-100 border border-rose-100 text-rose-700 rounded-lg text-[10px] font-bold flex items-center gap-1 transition"
                    >
                      <LogOut className="w-3.5 h-3.5" />
                      <span>Lock Console</span>
                    </button>
                  </div>
                </div>

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
                      staffMode={true}
                      staff={staff}
                      settings={settings}
                    />
                  </div>
                ) : (
                  <div className="space-y-6">
                    {/* Switch Modules Tab bar */}
                    <div className="flex gap-1.5 border-b border-slate-200 overflow-x-auto pb-px">
                      <button
                        onClick={() => setAdminTab('bookings')}
                        className={`px-4 py-2.5 text-xs font-semibold whitespace-nowrap tracking-wide transition-all border-b-2 ${
                          adminTab === 'bookings'
                            ? 'border-primary text-primary font-bold'
                            : 'border-transparent text-slate-500 hover:text-slate-800'
                        }`}
                      >
                        Bookings List ({appointments.length})
                      </button>
                      
                      <button
                        onClick={() => setAdminTab('staff')}
                        className={`px-4 py-2.5 text-xs font-semibold whitespace-nowrap tracking-wide transition-all border-b-2 ${
                          adminTab === 'staff'
                            ? 'border-primary text-primary font-bold'
                            : 'border-transparent text-slate-500 hover:text-slate-800'
                        }`}
                      >
                        Staff Directory ({staff.length})
                      </button>

                      <button
                        onClick={() => setAdminTab('settings')}
                        className={`px-4 py-2.5 text-xs font-semibold whitespace-nowrap tracking-wide transition-all border-b-2 ${
                          adminTab === 'settings'
                            ? 'border-primary text-primary font-bold'
                            : 'border-transparent text-slate-500 hover:text-slate-800'
                        }`}
                      >
                        Business Profile settings
                      </button>

                      <button
                        onClick={() => setAdminTab('availability')}
                        className={`px-4 py-2.5 text-xs font-semibold whitespace-nowrap tracking-wide transition-all border-b-2 ${
                          adminTab === 'availability'
                            ? 'border-primary text-primary font-bold'
                            : 'border-transparent text-slate-500 hover:text-slate-800'
                        }`}
                      >
                        Operational Hours &amp; Holds
                      </button>
                      
                      <button
                        onClick={() => setAdminTab('services')}
                        className={`px-4 py-2.5 text-xs font-semibold whitespace-nowrap tracking-wide transition-all border-b-2 ${
                          adminTab === 'services'
                            ? 'border-primary text-primary font-bold'
                            : 'border-transparent text-slate-500 hover:text-slate-800'
                        }`}
                      >
                        Services Catalog ({services.length})
                      </button>
                      
                      <button
                        onClick={() => setAdminTab('templates')}
                        className={`px-4 py-2.5 text-xs font-semibold whitespace-nowrap tracking-wide transition-all border-b-2 ${
                          adminTab === 'templates'
                            ? 'border-primary text-primary font-bold'
                            : 'border-transparent text-slate-500 hover:text-slate-800'
                        }`}
                      >
                        Templates &amp; Communications
                      </button>

                      <button
                        onClick={() => setAdminTab('mysql')}
                        className={`px-4 py-2.5 text-xs font-semibold whitespace-nowrap tracking-wide transition-all border-b-2 ${
                          adminTab === 'mysql'
                            ? 'border-primary text-primary font-bold'
                            : 'border-transparent text-slate-500 hover:text-slate-800'
                        }`}
                      >
                        MySQL Engine Hub
                      </button>
                    </div>

                    {/* MOUNT ACTIVE TAB WORKFLOW */}
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
                        emailLogs={[]} // Fixed: Bypassed safely with an empty array to match historical cleanup
                        adminPassword={adminPassword}
                        onTemplateUpdated={(tpl) => {
                          setEmailTemplates(prev => prev.map(t => t.id === tpl.id ? tpl : t));
                        }}
                      />
                    )}

                    {adminTab === 'mysql' && (
                      <AdminMySqlConfig />
                    )}
                  </div>
                )}

              </div>
            )}

          </div>
        )}

      </main>

      {/* FOOTER */}
      <footer className="bg-white border-t border-slate-100 py-6 text-center text-slate-400 text-xs mt-auto">
        <div className="max-w-7xl mx-auto px-4">
          <p>© 2026 {settings.businessName || 'My Business Name'}. Complete integrated Full-Stack scheduling application.</p>
        </div>
      </footer>
    </div>
  );
}