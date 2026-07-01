import React, { useState } from 'react';
import { Sparkles, Calendar, Clock, ToggleLeft, ToggleRight, Trash2, Plus, Copy } from 'lucide-react';
import { DAYS_OF_WEEK } from '../utils';

export default function AdminAvailability({
  availability,
  customBlocks,
  adminPassword = '',
  onAvailabilityUpdated,
  onCustomBlocksUpdated
}) {
  const [loading, setLoading] = useState(false);
  const [availList, setAvailList] = useState([...availability]);

  // Block out custom dates form state
  const [bDate, setBDate] = useState('');
  const [bReason, setBReason] = useState('');
  const [blockAllDay, setBlockAllDay] = useState(true);
  const [bStart, setBStart] = useState('09:00');
  const [bEnd, setBEnd] = useState('12:00');

  // Modify individual rows local state
  const handleToggleWorkingDay = (dayIndex) => {
    const updated = availList.map(a => {
      if (a.dayOfWeek === dayIndex) {
        return { ...a, isWorkingDay: !a.isWorkingDay };
      }
      return a;
    });
    setAvailList(updated);
  };

  const handleTimeChange = (dayIndex, field, value) => {
    const updated = availList.map(a => {
      if (a.dayOfWeek === dayIndex) {
        return { ...a, [field]: value };
      }
      return a;
    });
    setAvailList(updated);
  };

  // Submit standard business hours to backend
  const handleSaveHours = async () => {
    setLoading(true);
    try {
      const response = await fetch('/api/availability', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          password: adminPassword,
          config: availList
        })
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error);

      onAvailabilityUpdated(data.config);
      alert('Weekday working hours synced successfully!');
    } catch (err) {
      alert('Error updating business hours: ' + err.message);
    } finally {
      setLoading(false);
    }
  };

  // Submit new custom holiday / blocked date
  const handleAddCustomBlock = async (e) => {
    e.preventDefault();
    if (!bDate) {
      alert('Please specify a date to block out.');
      return;
    }

    const newBlock = {
      id: 'blk-' + Math.random().toString(36).substr(2, 9),
      date: bDate,
      reason: bReason.trim() || 'Custom staff training session',
      startTime: blockAllDay ? '00:00' : bStart,
      endTime: blockAllDay ? '24:00' : bEnd
    };

    const finalBlocks = [...customBlocks, newBlock];
    setLoading(true);

    try {
      const response = await fetch('/api/custom-blocks', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          password: adminPassword,
          blocks: finalBlocks
        })
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error);

      onCustomBlocksUpdated(data.blocks);
      setBDate('');
      setBReason('');
    } catch (err) {
      alert('Error saving custom blocks: ' + err.message);
    } finally {
      setLoading(false);
    }
  };

  // Delete a blocked date row
  const handleDeleteBlock = async (id) => {
    const finalBlocks = customBlocks.filter(b => b.id !== id);
    setLoading(true);
    try {
      const response = await fetch('/api/custom-blocks', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          password: adminPassword,
          blocks: finalBlocks
        })
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error);

      onCustomBlocksUpdated(data.blocks);
    } catch (err) {
      alert('Error deleting block: ' + err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-8">
      {/* 1. WEEKDAY WORKING HOURS MANAGER */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6 space-y-4">
        <div className="flex justify-between items-center flex-wrap gap-4 pb-4 border-b border-slate-150">
          <div>
            <h4 className="font-display font-bold text-slate-900 text-sm">Default Weekly Schedules</h4>
            <p className="text-xs text-slate-500 mt-1">Select business toggle times and block out lunch hour breaks.</p>
          </div>
          <button
            id="save-avail-hours-btn"
            onClick={handleSaveHours}
            disabled={loading}
            className="bg-primary border border-primary text-white hover:bg-primary/95 rounded-lg text-xs font-bold px-4 py-2.5 shadow-md shadow-primary/10 cursor-pointer transition-all"
          >
            {loading ? 'Saving schedules...' : 'Sync Weekly Schedule'}
          </button>
        </div>

        <div className="divide-y divide-slate-100 text-xs">
          {DAYS_OF_WEEK.map((dayName, idx) => {
            const config = availList.find(a => a.dayOfWeek === idx);
            if (!config) return null;

            return (
              <div key={idx} className="py-4 sm:flex justify-between items-center gap-4">
                <div className="w-28 font-bold text-slate-800 flex items-center gap-2 mb-2 sm:mb-0">
                  <button 
                    type="button"
                    onClick={() => handleToggleWorkingDay(idx)} 
                    className="text-slate-500 hover:text-slate-900 transition-all cursor-pointer"
                  >
                    {config.isWorkingDay ? (
                      <ToggleRight className="w-6 h-6 text-primary" />
                    ) : (
                      <ToggleLeft className="w-6 h-6 text-slate-300" />
                    )}
                  </button>
                  <span className="text-xs tracking-wide">{dayName}</span>
                </div>

                {config.isWorkingDay ? (
                  <div className="flex flex-wrap items-center gap-x-6 gap-y-3 text-[11px] text-slate-650 font-semibold">
                    {/* Shift Hours */}
                    <div className="flex items-center gap-2">
                      <Clock className="w-3.5 h-3.5 text-primary" />
                      <span>Shift Hours:</span>
                      <input
                        type="time"
                        value={config.startTime}
                        onChange={(e) => handleTimeChange(idx, 'startTime', e.target.value)}
                        className="border border-slate-250 bg-slate-50 rounded-lg px-2.5 py-1 text-[11px] outline-none font-bold text-slate-800 focus:bg-white focus:border-primary"
                      />
                      <span className="text-slate-400 font-normal">to</span>
                      <input
                        type="time"
                        value={config.endTime}
                        onChange={(e) => handleTimeChange(idx, 'endTime', e.target.value)}
                        className="border border-slate-250 bg-slate-50 rounded-lg px-2.5 py-1 text-[11px] outline-none font-bold text-slate-800 focus:bg-white focus:border-primary"
                      />
                    </div>

                    {/* Break Hours */}
                    <div className="flex items-center gap-2">
                      <span className="text-slate-400 font-normal">Break:</span>
                      <input
                        type="time"
                        value={config.breakTimeStart || '12:00'}
                        onChange={(e) => handleTimeChange(idx, 'breakTimeStart', e.target.value)}
                        className="border border-slate-250 bg-slate-50 rounded-lg px-2.5 py-1 text-[11px] outline-none font-bold text-slate-800 focus:bg-white focus:border-primary"
                      />
                      <span className="text-slate-400 font-normal">to</span>
                      <input
                        type="time"
                        value={config.breakTimeEnd || '13:00'}
                        onChange={(e) => handleTimeChange(idx, 'breakTimeEnd', e.target.value)}
                        className="border border-slate-250 bg-slate-50 rounded-lg px-2.5 py-1 text-[11px] outline-none font-bold text-slate-800 focus:bg-white focus:border-primary"
                      />
                    </div>
                  </div>
                ) : (
                  <div className="text-[10px] font-bold text-rose-600 bg-rose-55 px-3 py-1 rounded-full uppercase tracking-wider">
                    Closed (No Bookings Allowed)
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* 2. CUSTOM CLOSURES & TIME BLOCKS */}
      <div className="grid md:grid-cols-2 gap-6">
        {/* ADD CLOSURE FORM */}
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6 space-y-4 h-fit">
          <div>
            <h4 className="font-display font-bold text-slate-900 text-sm">Add Custom Block / Holiday</h4>
            <p className="text-xs text-slate-400 mt-0.5">Temporarily prevent scheduling for holidays, breaks, or events.</p>
          </div>

          <form onSubmit={handleAddCustomBlock} className="space-y-4 text-xs">
            <div>
              <label className="block text-slate-700 font-semibold mb-1.5">Target Date</label>
              <input
                id="block-inp-date"
                type="date"
                required
                value={bDate}
                onChange={(e) => setBDate(e.target.value)}
                className="w-full bg-slate-50 border border-slate-200 rounded-lg p-2.5 font-semibold text-slate-800 outline-none focus:bg-white focus:border-primary focus:ring-2 focus:ring-secondary/50 transition-all cursor-pointer"
              />
            </div>

            <div>
              <label className="block text-slate-700 font-semibold mb-1.5">Reason / Description</label>
              <input
                id="block-inp-reason"
                type="text"
                placeholder="e.g., Staff Wellness / Training Retreat"
                value={bReason}
                onChange={(e) => setBReason(e.target.value)}
                className="w-full bg-slate-50 border border-slate-200 rounded-lg p-2.5 font-semibold text-slate-800 outline-none focus:bg-white focus:border-primary focus:ring-2 focus:ring-secondary/50 transition-all"
              />
            </div>

            <div className="flex gap-4 p-3 bg-slate-50 border border-slate-200/80 rounded-xl">
              <label className="flex items-center gap-1.5 font-bold text-slate-700 cursor-pointer select-none text-[11px]">
                <input
                  id="radio-block-allday"
                  type="radio"
                  checked={blockAllDay}
                  onChange={() => setBlockAllDay(true)}
                  className="w-4 h-4 text-primary focus:ring-secondary/40 cursor-pointer"
                />
                Block Entire Day
              </label>
              <label className="flex items-center gap-1.5 font-bold text-slate-700 cursor-pointer select-none text-[11px]">
                <input
                  id="radio-block-partial"
                  type="radio"
                  checked={!blockAllDay}
                  onChange={() => setBlockAllDay(false)}
                  className="w-4 h-4 text-primary focus:ring-secondary/40 cursor-pointer"
                />
                Partial Hours Block
              </label>
            </div>

            {!blockAllDay && (
              <div className="grid grid-cols-2 gap-3 animate-fade-in">
                <div>
                  <label className="block text-[10px] uppercase font-bold text-slate-400 mb-1.5">Start Time</label>
                  <input
                    type="time"
                    value={bStart}
                    onChange={(e) => setBStart(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-200 rounded-lg px-2.5 py-2 font-bold text-slate-800 outline-none focus:bg-white focus:border-primary focus:ring-2 focus:ring-secondary/50"
                  />
                </div>
                <div>
                  <label className="block text-[10px] uppercase font-bold text-slate-400 mb-1.5">End Time</label>
                  <input
                    type="time"
                    value={bEnd}
                    onChange={(e) => setBEnd(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-200 rounded-lg px-2.5 py-2 font-bold text-slate-800 outline-none focus:bg-white focus:border-primary focus:ring-2 focus:ring-secondary/50"
                  />
                </div>
              </div>
            )}

            <button
              id="block-submit-btn"
              type="submit"
              className="w-full bg-primary border border-primary hover:bg-primary/95 text-white font-bold rounded-lg py-2.5 text-xs shadow-md shadow-primary/10 cursor-pointer transition-all"
            >
              Add Hold Request
            </button>
          </form>
        </div>

        {/* CURRENT BLOCKED LIST */}
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6 space-y-4 flex flex-col justify-between">
          <div className="space-y-4">
            <div>
              <h4 className="font-display font-bold text-slate-900 text-sm">Active Schedules Blocked</h4>
              <p className="text-xs text-slate-400 mt-0.5">List of days off and partial hold requests in calendar.</p>
            </div>

            <div className="divide-y divide-slate-100 max-h-[310px] overflow-y-auto pr-1">
              {customBlocks.map((b) => (
                <div key={b.id} className="py-3 flex justify-between gap-3 text-xs items-start">
                  <div>
                    <strong className="text-slate-900 font-display font-medium text-sm">{b.date}</strong>
                    <div className="text-slate-500 font-semibold text-[11px] mt-0.5">{b.reason || 'Closed'}</div>
                    <div className="text-[10px] font-mono font-bold text-primary bg-secondary/30 rounded-full px-2 py-0.5 w-fit mt-1.5">
                      {b.startTime && b.endTime ? `Hours: ${b.startTime} - ${b.endTime}` : 'All Day Block'}
                    </div>
                  </div>
                  <button
                    id={`del-block-btn-${b.id}`}
                    onClick={() => handleDeleteBlock(b.id)}
                    className="p-1 px-1.5 h-fit bg-white border border-rose-100 text-rose-500 hover:bg-rose-50 hover:border-rose-200 rounded-lg transition-all mt-1 cursor-pointer"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              ))}
              {customBlocks.length === 0 && (
                <div className="text-center py-16 text-slate-400 font-medium">No custom holiday overrides are set.</div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
