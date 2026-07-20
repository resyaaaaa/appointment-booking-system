import React, { useState } from 'react';
import { Settings, Check, HelpCircle } from 'lucide-react';
const API_URL = (import.meta.env.VITE_API_URL || '').replace(/\/$/, '');

export default function AdminSettings({
  settings,
  adminPassword,
  onSettingsUpdated
}) {
  const [loading, setLoading] = useState(false);
  const [businessName, setBusinessName] = useState(settings.businessName || 'My business Name');
  const [currency, setCurrency] = useState(settings.currency || 'RM');
  const [address, setAddress] = useState(settings.address || '404 Design District, Suite 300');
  const [contactEmail, setContactEmail] = useState(settings.contactEmail || 'name@example.com');
  const [contactPhone, setContactPhone] = useState(settings.contactPhone || '555-0100');
  const [success, setSuccess] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setSuccess(false);

    try {
      const payload = {
        password: adminPassword,
        settings: {
          businessName,
          currency,
          address,
          contactEmail,
          contactPhone
        }
      };

      const response = await fetch(`${API_URL}/api/settings`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error);

      onSettingsUpdated(data.settings);
      setSuccess(true);
      setTimeout(() => setSuccess(false), 3005);
    } catch (err) {
      alert('Error saving business profile settings: ' + err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-2xl mx-auto bg-white rounded-xl border border-slate-202 p-6 shadow-sm">
      <div className="flex items-center gap-2 pb-4 border-b border-slate-100 mb-5">
        <Settings className="w-5 h-5 text-primary" />
        <div>
          <h4 className="font-display font-semibold text-slate-905 text-sm">Business Profile &amp; Settings</h4>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="space-y-4 text-xs">
        <div className="grid sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-slate-705 font-semibold mb-1">Company / Business Name</label>
            <input
              type="text"
              required
              value={businessName}
              onChange={(e) => setBusinessName(e.target.value)}
              className="w-full p-2.5 bg-slate-50 border border-slate-205 rounded-lg focus:outline-none focus:bg-white focus:border-primary focus:ring-1 focus:ring-secondary/50 font-medium"
            />
          </div>

          <div>
            <label className="block text-slate-705 font-semibold mb-1 flex items-center gap-1">
              <span>Local Currency</span>
              <span className="text-[9px] text-slate-400 font-normal hover:text-slate-600" title="Supports e.g., $, €, £, AED, CHF, SGD etc.">
                (e.g., $, €, £, USD, EUR)
              </span>
            </label>
            <input
              type="text"
              required
              value={currency}
              onChange={(e) => setCurrency(e.target.value)}
              placeholder="e.g. $, SGD, EUR"
              className="w-full p-2.5 bg-slate-50 border border-slate-250 rounded-lg focus:outline-none focus:bg-white focus:border-primary focus:ring-1 focus:ring-secondary/50 font-mono font-semibold"
            />
          </div>
        </div>

        <div>
          <label className="block text-slate-705 font-semibold mb-1 col-span-2">Physical Location Address</label>
          <input
            type="text"
            value={address}
            onChange={(e) => setAddress(e.target.value)}
            placeholder="e.g. 404 Design District, Suite 300"
            className="w-full p-2.5 bg-slate-50 border border-slate-205 rounded-lg focus:outline-none focus:bg-white focus:border-primary focus:ring-1 focus:ring-secondary/50"
          />
        </div>

        <div className="grid sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-slate-705 font-semibold mb-1">Business Email</label>
            <input
              type="email"
              value={contactEmail}
              onChange={(e) => setContactEmail(e.target.value)}
              className="w-full p-2.5 bg-slate-50 border border-slate-205 rounded-lg focus:outline-none focus:bg-white focus:border-primary focus:ring-1 focus:ring-secondary/50"
            />
          </div>

          <div>
            <label className="block text-slate-705 font-semibold mb-1">Contact Number</label>
            <input
              type="text"
              value={contactPhone}
              onChange={(e) => setContactPhone(e.target.value)}
              className="w-full p-2.5 bg-slate-50 border border-slate-205 rounded-lg focus:outline-none focus:bg-white focus:border-primary focus:ring-1 focus:ring-secondary/50"
            />
          </div>
        </div>

        <div className="pt-4 border-t border-slate-100 flex items-center justify-between flex-wrap gap-3">
          {success ? (
            <span className="bg-emerald-50 text-emerald-800 text-[10.5px] px-3 py-1.5 rounded-lg border border-emerald-150 flex items-center gap-1.5 animate-bounce">
              <Check className="w-3.5 h-3.5 text-emerald-600" />
              <span>Settings synchronized permanently!</span>
            </span>
          ) : (
            <span className="text-[10px] text-slate-400">All configurations synchronize automatically with our file store.</span>
          )}

          <button
            type="submit"
            disabled={loading}
            className="bg-primary hover:bg-primary/95 text-white font-bold px-5 py-2.5 rounded-lg transition text-xs shadow-sm flex items-center gap-1 shrink-0 ml-auto"
          >
            {loading ? 'Propagating settings...' : 'Save Settings'}
          </button>
        </div>
      </form>
    </div>
  );
}
