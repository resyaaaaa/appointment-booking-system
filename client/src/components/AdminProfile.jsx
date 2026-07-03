import React, { useState } from 'react';
import { 
  User, 
  Mail, 
  Phone, 
  Lock, 
  Shield, 
  CheckCircle2, 
  AlertTriangle, 
  RefreshCcw 
} from 'lucide-react';

export default function AdminProfile({
  currentUser,
  staff,
  onProfileUpdated,
  onRefreshData
}) {
  const [name, setName] = useState(currentUser?.name || '');
  const [phone, setPhone] = useState(currentUser?.phone || '');
  const [password, setPassword] = useState('');
  const [formSuccess, setFormSuccess] = useState('');
  const [formError, setFormError] = useState('');
  const [loading, setLoading] = useState(false);
  const [linkLoading, setLinkLoading] = useState(false);

  // Check connection to staff directory based on registered email
  const connectedStaffMember = staff.find(
    s => s.email?.toLowerCase() === currentUser?.email?.toLowerCase()
  );

  const handleConnectToStaffDirectory = async () => {
    setFormSuccess('');
    setFormError('');
    setLinkLoading(true);

    try {
      const response = await fetch('/api/auth/link-staff', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId: currentUser.id
        })
      });

      const data = await response.json();
      if (!response.ok || !data.success) {
        throw new Error(data.error || 'Failed to link account to the staff directory.');
      }

      setFormSuccess('Successfully linked your profile to the Salon Specialist Directory!');
      
      // Trigger global data reload (stretching to refresh staff listings)
      if (onRefreshData) {
        await onRefreshData();
      }

      setTimeout(() => setFormSuccess(''), 5000);
    } catch (err) {
      setFormError(err.message || 'Failed to connect account.');
    } finally {
      setLinkLoading(false);
    }
  };

  const handleUpdateProfile = async (e) => {
    e.preventDefault();
    setFormSuccess('');
    setFormError('');
    setLoading(true);

    try {
      const response = await fetch('/api/auth/update-profile', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId: currentUser.id,
          name,
          phone,
          password: password || undefined
        })
      });

      const data = await response.json();
      if (!response.ok || !data.success) {
        throw new Error(data.error || 'Failed to update profile details.');
      }

      onProfileUpdated(data.user);
      setPassword('');
      setFormSuccess('Profile details updated successfully!');
      
      // Refresh global app data to apply name change across the board
      if (onRefreshData) {
        await onRefreshData();
      }

      setTimeout(() => setFormSuccess(''), 4000);
    } catch (err) {
      setFormError(err.message || 'Error occurred while updating profile.');
    } finally {
      setLoading(false);
    }
  };

  const hasAttemptedAutoLink = React.useRef(false);

  React.useEffect(() => {
    if (currentUser && !connectedStaffMember && !hasAttemptedAutoLink.current && !linkLoading) {
      hasAttemptedAutoLink.current = true;
      handleConnectToStaffDirectory();
    }
  }, [currentUser, connectedStaffMember]);

  return (
    <div className="grid md:grid-cols-3 gap-6 max-w-4xl mx-auto items-start">
      
      {/* LEFT COLUMN: STAFF STATUS CARD */}
      <div className="md:col-span-1 space-y-6">
        <div className="bg-white rounded-2xl border border-slate-200/80 shadow-[0_4px_20px_rgba(15,23,42,0.02)] p-5 text-center relative overflow-hidden">
          {/* Subtle colored accent circle */}
          <div className={`absolute -top-10 -right-10 w-24 h-24 rounded-full opacity-10 ${
            connectedStaffMember ? 'bg-emerald-500' : 'bg-[#3a4f99]'
          }`} />

          <div className="mx-auto w-16 h-16 bg-slate-50 border border-slate-100 rounded-full flex items-center justify-center text-slate-700 font-display font-extrabold text-xl shadow-xs relative z-10">
            {currentUser?.name?.slice(0, 2).toUpperCase() || 'ST'}
          </div>

          <h3 className="font-display font-bold text-slate-900 text-sm mt-3.5 tracking-tight">
            {currentUser?.name}
          </h3>
          <p className="text-[10px] text-slate-400 font-mono tracking-widest font-extrabold uppercase mt-0.5">
            {currentUser?.role === 'owner' ? 'Salon Owner' : 'Stylist / Staff'}
          </p>

          <div className="border-t border-slate-100 my-4 pt-4 text-xs space-y-2 text-left leading-normal">
            <div className="flex items-center gap-2 text-slate-600">
              <Mail className="w-4 h-4 text-slate-400 shrink-0" />
              <span className="truncate" title={currentUser?.email}>{currentUser?.email}</span>
            </div>
            {currentUser?.phone && (
              <div className="flex items-center gap-2 text-slate-600">
                <Phone className="w-4 h-4 text-slate-400 shrink-0" />
                <span>{currentUser.phone}</span>
              </div>
            )}
            <div className="flex items-center gap-2 text-slate-600">
              <Shield className="w-4 h-4 text-slate-400 shrink-0" />
              <span>System Role: <strong className="capitalize">{currentUser?.role}</strong></span>
            </div>
          </div>
        </div>
      </div>

      {/* RIGHT COLUMN: UPDATE PROFILE FORM */}
      <div className="md:col-span-2 bg-white rounded-2xl border border-slate-200/80 shadow-[0_4px_20px_rgba(15,23,42,0.02)] p-6 space-y-5">
        <div className="border-b border-slate-100 pb-3">
          <h3 className="font-display font-bold text-slate-900 text-sm">Account Settings</h3>
        </div>

        {formSuccess && (
          <div className="bg-emerald-50 text-emerald-800 text-xs font-semibold p-3.5 rounded-xl border border-emerald-100 animate-fade-in">
            {formSuccess}
          </div>
        )}

        {formError && (
          <div className="bg-rose-50 text-rose-800 text-xs font-semibold p-3.5 rounded-xl border border-rose-100 animate-fade-in">
            {formError}
          </div>
        )}

        <form onSubmit={handleUpdateProfile} className="space-y-4 text-xs font-sans">
          <div className="grid sm:grid-cols-2 gap-4">
            <div className="space-y-1">
              <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider">Account Full Name</label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400">
                  <User size={14} />
                </div>
                <input
                  type="text"
                  required
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Employee Full Name"
                  className="w-full text-xs pl-9 p-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:outline-none focus:border-primary focus:ring-4 focus:ring-primary/5 transition font-semibold"
                />
              </div>
            </div>

            <div className="space-y-1">
              <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider">Contact Phone Number</label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400">
                  <Phone size={14} />
                </div>
                <input
                  type="tel"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  placeholder="e.g., 012-3456789"
                  className="w-full text-xs pl-9 p-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:outline-none focus:border-primary focus:ring-4 focus:ring-primary/5 transition font-semibold"
                />
              </div>
            </div>
          </div>

          <div className="space-y-1">
            <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider">Email Address</label>
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-300">
                <Mail size={14} />
              </div>
              <input
                type="email"
                disabled
                value={currentUser?.email || ''}
                className="w-full text-xs pl-9 p-2.5 bg-slate-100 border border-slate-200 rounded-xl text-slate-450 cursor-not-allowed font-medium"
              />
            </div>
          </div>

          <div className="pt-3 border-t border-slate-100">
            <div className="space-y-1">
              <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1 text-slate-500">
                <Lock size={12} className="text-slate-400" />
                <span>Update Account Password</span>
              </label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="•••••••• (Leave empty to keep secure/unchanged)"
                className="w-full text-xs p-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:outline-none focus:border-primary focus:ring-4 focus:ring-primary/5 transition font-semibold"
              />
            </div>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-primary hover:bg-primary/95 text-white font-bold text-xs py-3 rounded-xl transition shadow-md shadow-primary/10 mt-4 cursor-pointer disabled:opacity-50"
          >
            {loading ? 'Saving Profile Changes...' : 'Save Profile Changes'}
          </button>
        </form>
      </div>

    </div>
  );
}
