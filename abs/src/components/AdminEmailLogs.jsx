import React, { useState, useEffect } from 'react';
import { Sparkles, Mail, FileText, Send, Clock, Edit3, CheckCircle, Terminal, AlertTriangle, Check } from 'lucide-react';

export default function AdminEmailLogs({
  emailTemplates,
  emailLogs,
  adminPassword = '',
  onTemplateUpdated
}) {
  const [selectedTemplateId, setSelectedTemplateId] = useState(emailTemplates[0]?.id || '');
  const [editingBody, setEditingBody] = useState('');
  const [editingSubject, setEditingSubject] = useState('');
  const [saveStatus, setSaveStatus] = useState('');
  const [loading, setLoading] = useState(false);

  // SMTP Gmail Service states
  const [gatewayStatus, setGatewayStatus] = useState({ provider: 'gmail', configured: false, user: '' });
  const [testRecipient, setTestRecipient] = useState('');
  const [testLog, setTestLog] = useState('');
  const [testSending, setTestSending] = useState(false);

  // Load gateway status on mount
  useEffect(() => {
    fetch('/api/email-services')
      .then(res => res.json())
      .then(data => setGatewayStatus(data))
      .catch(err => console.error('Failed to load gateway status', err));
  }, []);

  const handleTestMailSubmit = async (e) => {
    e.preventDefault();
    if (!testRecipient) return;
    setTestSending(true);
    setTestLog('');
    try {
      const res = await fetch('/api/email-services/test', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          password: adminPassword,
          recipient: testRecipient
        })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'SMTP delivery failure');
      setTestLog(`Success: ${data.message}`);
      setTestRecipient('');
    } catch (err) {
      setTestLog(`Error: ${err.message}`);
    } finally {
      setTestSending(false);
    }
  };

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
      const response = await fetch('/api/email-templates', {
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
    <div className="space-y-6 text-xs">
      <div className="bg-slate-50 border border-slate-200/80 p-5 rounded-2xl shadow-sm">
        <h4 className="font-display font-bold text-slate-900 text-base">Professional Notifications & Templates</h4>
        <p className="text-xs text-slate-500 leading-relaxed font-semibold mt-0.5">Review, test and customize pre-defined email variables. System placeholder fields automatically map client details on dispatch.</p>
      </div>

      <div className="grid md:grid-cols-12 gap-6">
        {/* LEFT PANEL: TEMPLATE EDITOR */}
        <div className="md:col-span-6 bg-white rounded-2xl border border-slate-200 shadow-sm p-6 space-y-4">
          <div className="space-y-2.5">
            <h5 className="font-display font-bold text-slate-900 text-sm">Template Definitions</h5>
            <div className="flex gap-2.5">
              {emailTemplates.map(t => (
                <button
                  key={t.id}
                  onClick={() => setSelectedTemplateId(t.id)}
                  className={`px-4 py-2 rounded-xl font-bold border text-[10px] uppercase tracking-wide transition-all cursor-pointer ${selectedTemplateId === t.id
                      ? 'bg-primary border-primary text-white shadow-md shadow-primary/10'
                      : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-50'
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
                <div className={`p-3 rounded-xl text-xs font-bold leading-relaxed animate-fade-in ${saveStatus.includes('successfully') ? 'bg-emerald-50 text-emerald-800 border-emerald-250 border' : 'bg-rose-50 text-rose-800 border-rose-220 border'
                  }`}>
                  {saveStatus}
                </div>
              )}

              <div>
                <label className="block text-slate-700 font-bold mb-1.5 uppercase text-[10px] tracking-wide">Subject Header Rule</label>
                <input
                  id="tpl-inp-subj"
                  type="text"
                  value={editingSubject}
                  onChange={(e) => setEditingSubject(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-200 rounded-lg p-2.5 font-bold text-slate-800 outline-none focus:bg-white focus:border-primary focus:ring-2 focus:ring-secondary/50 transition-all font-sans"
                />
              </div>

              <div>
                <label className="block text-slate-700 font-bold mb-1.5 uppercase text-[10px] tracking-wide">Letter / Body Content</label>
                <textarea
                  id="tpl-inp-body"
                  rows={8}
                  value={editingBody}
                  onChange={(e) => setEditingBody(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-200 rounded-lg p-3 font-mono text-[11px] text-slate-800 outline-none focus:bg-white focus:border-primary focus:ring-2 focus:ring-secondary/50 transition-all leading-relaxed"
                />
              </div>

              <div className="p-4 bg-slate-50 rounded-xl border border-slate-200 text-[10px] space-y-1.5">
                <span className="font-bold text-slate-400 uppercase tracking-widest block">Available System Placeholders</span>
                <div className="flex flex-wrap gap-x-3 gap-y-1.5 text-slate-600 font-mono font-bold select-all bg-white p-2 rounded-lg border border-slate-150">
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
                className="w-full bg-primary border border-primary text-white hover:bg-primary/95 py-2.5 rounded-lg text-xs font-bold shadow-md shadow-primary/10 cursor-pointer transition-all"
              >
                {loading ? 'Applying modifications...' : 'Save Template Modifications'}
              </button>
            </form>
          ) : (
            <p className="text-slate-400">Loading editor...</p>
          )}
        </div>

        {/* RIGHT PANEL: GATEWAY DIAGNOSTICS */}
        <div className="md:col-span-6 bg-slate-950 text-slate-200 rounded-xl p-5 shadow-inner border border-slate-900 flex flex-col justify-between">
          <div className="space-y-4">
            {/* EMAIL GATEWAY SERVICES DIAGNOSTICS */}
            <div className="border-b border-slate-800 pb-4 mb-4 space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-[10px] uppercase font-bold text-slate-400 tracking-wider">Outbound Gateway Services</span>
              </div>

              {gatewayStatus.configured ? (
                <div className="text-[10.5px] text-slate-350 bg-slate-900/50 p-3 rounded-lg border border-slate-800/80 space-y-1">
                  <p className="font-semibold text-slate-250 flex items-center gap-1.5 align-middle">
                    <Mail className="w-3.5 h-3.5 text-primary" />
                    <span>SMTP Service Provider: <strong className="text-white">Gmail App Account</strong></span>
                  </p>
                  <p className="text-slate-400 font-mono text-[9px] pl-5">Linked Address: {gatewayStatus.user}</p>
                </div>
              ) : (
                <div className="text-[10.5px] text-slate-400 bg-slate-900/30 p-3 rounded-lg border border-slate-900/80 leading-relaxed font-semibold">
                  Add <span className="text-slate-200 font-bold">GMAIL_USER</span> and <span className="text-slate-200 font-bold">GMAIL_APP_PASSWORD</span> environment configuration settings to route outgoing alerts automatically to client inboxes using highly encrypted Gmail SMTP.
                </div>
              )}

              {/* OUTBOUND SMTP MANUAL GATEWAY ROUTE TEST */}
              <form onSubmit={handleTestMailSubmit} className="space-y-2 mt-2">
                <div className="flex gap-2">
                  <input
                    type="email"
                    required
                    placeholder="Test recipient email (e.g. client@address.com)"
                    value={testRecipient}
                    onChange={(e) => setTestRecipient(e.target.value)}
                    className="flex-1 bg-slate-900 border border-slate-800 rounded px-2.5 py-1.5 text-slate-200 placeholder-slate-600 focus:outline-none focus:border-primary text-[10px] font-sans"
                  />
                  <button
                    type="submit"
                    disabled={testSending}
                    className="px-3 py-1.5 bg-primary hover:bg-primary/95 text-white rounded text-[10px] font-bold flex items-center gap-1 transition-colors disabled:opacity-50 cursor-pointer shrink-0"
                  >
                    <Send className="w-3 h-3" />
                    <span>{testSending ? 'Sending...' : 'Test Route'}</span>
                  </button>
                </div>
                {testLog && (
                  <p className={`text-[10px] font-mono leading-tight px-1 font-semibold ${testLog.startsWith('Success') ? 'text-emerald-400' : 'text-rose-400'}`}>
                    {testLog}
                  </p>
                )}
              </form>
            </div>
          </div>
        </div>
      </div>
    </div>

  );
}
