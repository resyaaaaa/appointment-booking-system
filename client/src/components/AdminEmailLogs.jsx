import React, { useState, useEffect } from 'react';
import { Mail, FileText, Save, CheckCircle } from 'lucide-react';
const API_URL = (import.meta.env.VITE_API_URL || '').replace(/\/$/, '');

export default function AdminEmailLogs({
  emailTemplates,
  adminPassword = '',
  onTemplateUpdated
}) {
  const [selectedTemplateId, setSelectedTemplateId] = useState(emailTemplates[0]?.id || '');
  const [editingBody, setEditingBody] = useState('');
  const [editingSubject, setEditingSubject] = useState('');
  const [saveStatus, setSaveStatus] = useState('');
  const [loading, setLoading] = useState(false);

  // Load a template into the editor
  const chosenTpl = emailTemplates.find(t => t.id === selectedTemplateId) || emailTemplates[0];

  // Initialize local editor state when template selection changes
  useEffect(() => {
    if (chosenTpl) {
      setEditingBody(chosenTpl.body);
      setEditingSubject(chosenTpl.subject);
      setSaveStatus('');
    }
  }, [selectedTemplateId, chosenTpl]);

  // Submit revised template to server
  const handleSaveTemplate = async (e) => {
    e.preventDefault();
    if (!chosenTpl) return;
    setLoading(true);
    setSaveStatus('');

    const revisedPayload = {
      password: adminPassword,
      template: {
        ...chosenTpl,
        subject: editingSubject.trim(),
        body: editingBody
      }
    };

    try {
      const response = await fetch(`${API_URL}/api/email-templates`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(revisedPayload)
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error);

      onTemplateUpdated(data.template);
      setSaveStatus('Template saved successfully!');
    } catch (err) {
      setSaveStatus('Failed: ' + err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6 text-xs max-w-3xl mx-auto">
      <div className="bg-white rounded-2xl border border-slate-200 shadow-[0_4px_24px_rgba(15,23,42,0.02)] p-6 space-y-5">
        <div className="space-y-2.5">
          <h5 className="font-display font-bold text-slate-900 text-sm">Select and configure notification template</h5>
          <div className="flex flex-wrap gap-2">
            {emailTemplates.map(t => (
              <button
                key={t.id}
                onClick={() => setSelectedTemplateId(t.id)}
                className={`px-4 py-2 rounded-xl font-bold border text-[10px] uppercase tracking-wide transition-all cursor-pointer ${selectedTemplateId === t.id
                  ? 'bg-primary border-primary text-white shadow-md shadow-primary/10'
                  : 'border-slate-200 bg-white text-slate-605 hover:bg-slate-50'
                  }`}
              >
                {t.name}
              </button>
            ))}
          </div>
        </div>

        {chosenTpl ? (
          <form onSubmit={handleSaveTemplate} className="space-y-4 text-left">
            {saveStatus && (
              <div className={`p-3.5 rounded-xl text-xs font-bold leading-relaxed animate-fade-in ${saveStatus.includes('successfully') ? 'bg-emerald-50 text-emerald-800 border-emerald-200 border' : 'bg-rose-50 text-rose-800 border-rose-200 border'
                }`}>
                {saveStatus}
              </div>
            )}

            <div>
              <label className="block text-slate-705 font-bold mb-1.5 uppercase text-[10px] tracking-wide">Subject Header</label>
              <input
                id="tpl-inp-subj"
                type="text"
                value={editingSubject}
                onChange={(e) => setEditingSubject(e.target.value)}
                className="w-full bg-slate-50 border border-slate-200 rounded-lg p-2.5 font-bold text-slate-800 outline-none focus:bg-white focus:border-primary focus:ring-4 focus:ring-primary/5 transition-all font-sans"
              />
            </div>

            <div>
              <label className="block text-slate-705 font-bold mb-1.5 uppercase text-[10px] tracking-wide">Body Content</label>
              <textarea
                id="tpl-inp-body"
                rows={10}
                value={editingBody}
                onChange={(e) => setEditingBody(e.target.value)}
                className="w-full bg-slate-50 border border-slate-200 rounded-lg p-3 font-mono text-[11px] text-slate-800 outline-none focus:bg-white focus:border-primary focus:ring-4 focus:ring-primary/5 transition-all leading-relaxed"
              />
            </div>

            <div className="p-4 bg-slate-50 rounded-xl border border-slate-200 text-[10px] space-y-2">
              <span className="font-bold text-slate-400 uppercase tracking-widest block">Use Only Available System Placeholders Here</span>
              <div className="flex flex-wrap gap-x-3 gap-y-1.5 text-slate-600 font-mono font-bold select-all bg-white p-2.5 rounded-lg border border-slate-150">
                <span>{"{customer_name}"}</span>
                <span>{"{appointment_date}"}</span>
                <span>{"{appointment_time}"}</span>
                <span>{"{service_name}"}</span>
                <span>{"{business_name}"}</span>
                <span>{"{notes}"}</span>
              </div>
            </div>

            <button
              id="tpl-submit-btn"
              type="submit"
              disabled={loading}
              className="w-full bg-primary border border-primary text-white hover:bg-primary/95 py-3 rounded-xl text-xs font-bold shadow-md shadow-primary/10 cursor-pointer transition-all flex items-center justify-center gap-2"
            >

              <span>{loading ? 'Applying modifications...' : 'Save Template Modifications'}</span>
            </button>
          </form>
        ) : (
          <p className="text-slate-400">Loading editor...</p>
        )}
      </div>
    </div>
  );
}
