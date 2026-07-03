import React, { useState } from 'react';
import { Sparkles, DollarSign, Clock, FileText, Check, Plus, Edit2, Trash2 } from 'lucide-react';
import { formatUSD } from '../utils';

export default function AdminServices({
  services,
  adminPassword = '',
  onServiceCreatedOrUpdated,
  onServiceDeleted
}) {
  const [editingService, setEditingService] = useState(null);

  // Custom Form States
  const [name, setName] = useState('');
  const [price, setPrice] = useState(0);
  const [duration, setDuration] = useState(30);
  const [desc, setDesc] = useState('');
  const [isActive, setIsActive] = useState(true);

  const [loading, setLoading] = useState(false);
  const [validationErr, setValidationErr] = useState('');

  const handleStartEdit = (srv) => {
    setEditingService(srv);
    setName(srv.name);
    setPrice(srv.price);
    setDuration(srv.durationMinutes);
    setDesc(srv.description);
    setIsActive(srv.isActive);
    setValidationErr('');
  };

  const handleStartCreate = () => {
    setEditingService({
      id: '',
      name: '',
      price: 25,
      durationMinutes: 30,
      description: '',
      isActive: true
    });
    setName('');
    setPrice(25);
    setDuration(30);
    setDesc('');
    setIsActive(true);
    setValidationErr('');
  };

  const handleSaveService = async (e) => {
    e.preventDefault();
    if (!name.trim()) {
      setValidationErr('Service name is mandatory.');
      return;
    }
    if (price < 0 || duration <= 0) {
      setValidationErr('Please type realistic numbers for price and duration.');
      return;
    }

    setLoading(true);
    setValidationErr('');

    const payload = {
      password: adminPassword,
      service: {
        id: editingService?.id || undefined, // undefined triggers random generation on backend
        name: name.trim(),
        price,
        durationMinutes: duration,
        description: desc.trim(),
        isActive
      }
    };

    try {
      const response = await fetch('/api/services', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || 'Server rejected saving service');
      }

      onServiceCreatedOrUpdated(data.service);
      setEditingService(null);
    } catch (err) {
      setValidationErr(err.message || 'Error occurred while saving service catalog.');
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteService = async (id) => {
    if (!window.confirm('Delete this service from directory? Overlapping future appointments may become unmappable.')) {
      return;
    }
    try {
      const r = await fetch(`/api/services/${id}?password=${encodeURIComponent(adminPassword)}`, {
        method: 'DELETE'
      });
      if (r.ok) {
        onServiceDeleted(id);
      }
    } catch (err) {
      alert('Failed to delete service on server');
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-slate-50 border border-slate-200/80 p-5 rounded-2xl shadow-sm">
        <div className="space-y-1">
          <h4 className="font-display font-bold text-slate-900 text-base">Services Catalog</h4>
          <p className="text-xs text-slate-500 leading-relaxed font-semibold">Configure service details and price structures for clients booking slots.</p>
        </div>
        <button
          id="add-service-shortcut-btn"
          onClick={handleStartCreate}
          className="bg-primary border border-primary text-white hover:bg-primary/95 text-xs px-4.5 py-2.5 rounded-xl font-bold flex items-center justify-center gap-1.5 shadow-md shadow-primary/10 cursor-pointer transition-all"
        >
          <span>Add Custom Service</span>
        </button>
      </div>

      {validationErr && (
        <div className="bg-rose-50 text-rose-800 text-xs p-3.5 rounded-xl border-l-4 border-rose-500 font-semibold animate-fade-in">
          {validationErr}
        </div>
      )}

      {/* CREATE / EDIT ACTIVE OVERLAY MODAL */}
      {editingService && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl p-6 border border-slate-205 max-w-md w-full shadow-2xl space-y-4 animate-fade-in text-left">
            <h4 className="font-display font-bold text-slate-900 text-base pb-2 border-b border-slate-100">
              {editingService.id ? 'Modify Catalog Service' : 'Add New Premium Service'}
            </h4>

            <form onSubmit={handleSaveService} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1.5">Service Name *</label>
                <input
                  id="srv-inp-name"
                  type="text"
                  required
                  placeholder="e.g., Deluxe Skin Glow Shave"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="w-full text-xs p-2.5 bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:border-primary focus:bg-white focus:ring-2 focus:ring-secondary/55 transition-all text-slate-800 font-medium"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1.5">Duration (Minutes)</label>
                  <div className="relative">
                    <Clock className="absolute left-3 top-3 w-4 h-4 text-slate-400" />
                    <input
                      id="srv-inp-duration"
                      type="number"
                      required
                      min={5}
                      value={duration}
                      onChange={(e) => setDuration(parseInt(e.target.value) || 0)}
                      className="w-full text-xs pl-9 pr-2.5 py-2.5 bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:border-primary focus:bg-white focus:ring-2 focus:ring-secondary/55 transition-all font-semibold text-slate-800"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-705 mb-1.5">Price (USD)</label>
                  <div className="relative">
                    <DollarSign className="absolute left-3 top-3 w-4 h-4 text-slate-400" />
                    <input
                      id="srv-inp-price"
                      type="number"
                      required
                      min={0}
                      value={price}
                      onChange={(e) => setPrice(parseInt(e.target.value) || 0)}
                      className="w-full text-xs pl-9 pr-2.5 py-2.5 bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:border-primary focus:bg-white focus:ring-2 focus:ring-secondary/55 transition-all font-semibold text-slate-800"
                    />
                  </div>
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1.5 font-sans">Catalog Description</label>
                <div className="relative">
                  <FileText className="absolute left-3 top-3 w-4 h-4 text-slate-400" />
                  <textarea
                    id="srv-inp-desc"
                    rows={2}
                    placeholder="Provide simple descriptive details..."
                    value={desc}
                    onChange={(e) => setDesc(e.target.value)}
                    className="w-full text-[11px] pl-9 pr-2 py-2 bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:border-primary focus:bg-white focus:ring-2 focus:ring-secondary/55 transition-all text-slate-705 font-semibold"
                  />
                </div>
              </div>

              <div className="flex items-center gap-2.5 bg-slate-50 p-3 rounded-lg border border-slate-100">
                <input
                  id="srv-inp-is-active"
                  type="checkbox"
                  checked={isActive}
                  onChange={(e) => setIsActive(e.target.checked)}
                  className="rounded border-slate-300 focus:outline-none w-4 h-4 text-primary focus:ring-secondary/50 cursor-pointer"
                />
                <label htmlFor="srv-inp-is-active" className="text-xs font-bold text-slate-700 cursor-pointer select-none">
                  Service is active and discoverable by clients
                </label>
              </div>

              <div className="flex justify-end gap-2 pt-3 border-t border-slate-150">
                <button
                  type="button"
                  onClick={() => setEditingService(null)}
                  className="px-4 py-2 border border-slate-250 bg-white hover:bg-slate-50 text-slate-700 rounded-lg text-xs font-semibold cursor-pointer"
                >
                  Discard
                </button>
                <button
                  id="srv-save-submit-btn"
                  type="submit"
                  disabled={loading}
                  className="bg-primary border border-primary text-white hover:bg-primary/95 rounded-lg px-4 py-2 text-xs font-bold transition shadow-md shadow-primary/10 cursor-pointer"
                >
                  {loading ? 'Saving to catalog...' : 'Apply Modifications'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* RENDER CURRENT SERVICES */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {services.map((srv) => (
          <div
            key={srv.id}
            className={`p-5 rounded-2xl border flex flex-col justify-between transition-all duration-200 hover:shadow-md ${srv.isActive ? 'border-slate-200 bg-white shadow-sm' : 'border-slate-255 bg-slate-50/70 text-slate-400'
              }`}
          >
            <div>
              <div className="flex justify-between items-start gap-4">
                <h5 className="font-display font-bold text-slate-900 text-sm truncate" title={srv.name}>{srv.name}</h5>
                <span className="font-display font-bold text-primary text-sm shrink-0">
                  {formatUSD(srv.price)}
                </span>
              </div>
              <p className={`text-[11px] leading-relaxed mt-2.5 h-12 line-clamp-3 font-medium ${srv.isActive ? 'text-slate-500' : 'text-slate-400'}`}>
                {srv.description || 'No business description provided.'}
              </p>
            </div>

            <div className="mt-4 pt-3.5 border-t border-slate-100 flex justify-between items-center text-xs">
              <span className={`text-[10px] uppercase tracking-wide font-bold ${srv.isActive ? 'text-slate-400' : 'text-slate-400/80'}`}>
                {srv.durationMinutes} Minutes
              </span>

              <div className="flex gap-1.5 items-center">
                <button
                  id={`edit-srv-btn-${srv.id}`}
                  onClick={() => handleStartEdit(srv)}
                  className="p-1 px-2.5 border border-slate-200 bg-white hover:border-slate-400 rounded-lg text-[10px] font-bold text-slate-700 flex items-center gap-1 cursor-pointer transition-all"
                >
                  <Edit2 className="w-3 h-3 text-slate-500" />
                  <span>Edit</span>
                </button>
                <button
                  id={`del-srv-btn-${srv.id}`}
                  onClick={() => handleDeleteService(srv.id)}
                  className="p-1.5 bg-white border border-rose-100 hover:bg-rose-50 hover:border-rose-200 text-rose-500 hover:text-rose-600 rounded-lg transition-all cursor-pointer"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>


  );
}
