import React, { useState } from 'react';
import { User, Mail, Shield, Plus, Trash2, ToggleLeft, ToggleRight } from 'lucide-react';

export default function AdminStaff({
  staff,
  adminPassword,
  onStaffUpdatedOrCreated,
  onStaffDeleted
}) {
  const [loading, setLoading] = useState(false);
  const [name, setName] = useState('');
  const [role, setRole] = useState('Stylist');
  const [email, setEmail] = useState('');
  const [active, setActive] = useState(true);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!name) {
      alert('Please fill out the staff member name.');
      return;
    }

    setLoading(true);
    try {
      const response = await fetch('/api/staff', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          password: adminPassword,
          member: { name, role, email, active }
        })
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error);

      onStaffUpdatedOrCreated(data.member);
      setName('');
      setRole('Stylist');
      setEmail('');
      setActive(true);
    } catch (err) {
      alert('Error updating staff catalog: ' + err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleToggleActive = async (member) => {
    setLoading(true);
    const updated = { ...member, active: !member.active };
    try {
      const response = await fetch('/api/staff', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          password: adminPassword,
          member: updated
        })
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error);

      onStaffUpdatedOrCreated(data.member);
    } catch (err) {
      alert('Error: ' + err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (id) => {
    if (!window.confirm('Delete this staff member? All assignable slots will revert to Any Available.')) {
      return;
    }
    setLoading(true);
    try {
      const response = await fetch(`/api/staff/${id}?password=${encodeURIComponent(adminPassword)}`, {
        method: 'DELETE'
      });
      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error);
      }

      onStaffDeleted(id);
    } catch (err) {
      alert('Error removing staff member: ' + err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="grid md:grid-cols-3 gap-6">
      {/* ADD/EDIT STAFF CARD */}
      <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-sm space-y-4">
        <h4 className="font-display font-bold text-sm text-slate-900">Add Professional Staff</h4>
        <form onSubmit={handleSubmit} className="space-y-3.5 text-xs">
          <div>
            <label className="block text-slate-705 font-semibold mb-1">Full Name *</label>
            <input
              type="text"
              required
              placeholder="e.g. Alex Rivera"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full p-2.5 bg-slate-50 border border-slate-205 rounded-lg focus:outline-none focus:bg-white focus:border-primary focus:ring-1 focus:ring-secondary/50"
            />
          </div>

          <div>
            <label className="block text-slate-705 font-semibold mb-1">Role / Designation</label>
            <input
              type="text"
              placeholder="e.g. Color Specialist"
              value={role}
              onChange={(e) => setRole(e.target.value)}
              className="w-full p-2.5 bg-slate-50 border border-slate-205 rounded-lg focus:outline-none focus:bg-white focus:border-primary focus:ring-1 focus:ring-secondary/50"
            />
          </div>

          <div>
            <label className="block text-slate-705 font-semibold mb-1">Staff Email</label>
            <input
              type="email"
              placeholder="e.g. alex@business.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full p-2.5 bg-slate-50 border border-slate-205 rounded-lg focus:outline-none focus:bg-white focus:border-primary focus:ring-1 focus:ring-secondary/50"
            />
          </div>

          <div className="flex items-center justify-between py-2 border-t border-slate-100 mt-2">
            <span className="font-semibold text-slate-700">Accepting Appointments</span>
            <button
              type="button"
              onClick={() => setActive(!active)}
              className="text-slate-50 focus:outline-none"
            >
              {active ? (
                <ToggleRight className="w-9 h-9 text-primary transition" />
              ) : (
                <ToggleLeft className="w-9 h-9 text-slate-350 transition" />
              )}
            </button>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-primary hover:bg-primary/95 text-white font-bold p-2.5 rounded-lg transition text-xs shadow-sm flex items-center justify-center gap-1"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Add Staff Member</span>
          </button>
        </form>
      </div>

      {/* STAFF LIST */}
      <div className="md:col-span-2 bg-white rounded-xl border border-slate-200 p-5 shadow-sm flex flex-col justify-between">
        <div>
          <h4 className="font-display font-bold text-sm text-slate-900 mb-4">Professional Directory</h4>
          <div className="space-y-3">
            {staff.map((member) => (
              <div
                key={member.id}
                className="p-3.5 rounded-xl border border-slate-150 flex items-center justify-between gap-4 hover:shadow-sm transition bg-slate-50/50"
              >
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-full bg-secondary/40 text-primary font-bold text-xs flex items-center justify-center">
                    {member.name.split(' ').map(n=>n[0]).join('').slice(0, 2).toUpperCase()}
                  </div>
                  <div>
                    <h5 className="font-bold text-slate-905 text-xs flex items-center gap-1.5">
                      <span>{member.name}</span>
                      {member.active ? (
                        <span className="bg-emerald-50 text-emerald-700 text-[9px] px-1.5 py-0.2 rounded font-semibold whitespace-nowrap uppercase">Bookable</span>
                      ) : (
                        <span className="bg-slate-100 text-slate-500 text-[9px] px-1.5 py-0.2 rounded font-semibold whitespace-nowrap uppercase">Inactive</span>
                      )}
                    </h5>
                    <p className="text-[10px] text-slate-500 font-medium mt-0.5">{member.role} • {member.email || 'No Email Listed'}</p>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    onClick={() => handleToggleActive(member)}
                    title={member.active ? 'Set Inactive' : 'Set Active'}
                    className={`p-1.5 rounded-lg border transition ${
                      member.active ? 'bg-emerald-50/50 border-emerald-200 text-emerald-600' : 'bg-slate-50 border-slate-200 text-slate-400'
                    }`}
                  >
                    {member.active ? 'Pause' : 'Activate'}
                  </button>
                  <button
                    onClick={() => handleDelete(member.id)}
                    className="p-2 bg-rose-50 border border-rose-100 text-rose-655 hover:bg-rose-100 rounded-lg transition"
                    title="Delete Professional"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            ))}

            {staff.length === 0 && (
              <div className="text-center py-8 bg-slate-50 rounded-xl border border-dashed border-slate-200">
                <p className="text-slate-400 text-xs">No staff members configured. Add staff to begin slot assignments.</p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
