import React, { useState, useMemo } from 'react';
import { 
  Calendar, 
  Search, 
  Trash2, 
  Mail, 
  Clock, 
  User, 
  Phone, 
  Filter, 
  AlertCircle, 
  Check, 
  MailCheck, 
  Send,
  Sparkles
} from 'lucide-react';
import { formatUSD, formatHumanDate, formatHumanDateTime } from '../utils';

export default function AdminBookings({
  appointments,
  services,
  emailTemplates,
  onBookingDeleted,
  onBookingUpdated,
  onAddBookingClick,
  staff = [],
  settings = {},
  adminPassword
}) {
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [dateFilter, setDateFilter] = useState('');
  const [staffFilter, setStaffFilter] = useState('all');
  
  // States for individual manual email trigger modal/popover
  const [activeMailApt, setActiveMailApt] = useState(null);
  const [selectedMailTemplateId, setSelectedMailTemplateId] = useState('');
  const [mailTriggering, setMailTriggering] = useState(false);
  const [mailSuccessAlert, setMailSuccessAlert] = useState('');

  // Map service ID to details
  const serviceMap = useMemo(() => {
    const map = {};
    services.forEach(s => {
      map[s.id] = s;
    });
    return map;
  }, [services]);

  // Combined Filters logic
  const filteredAppointments = useMemo(() => {
    return appointments.filter(apt => {
      const srvName = serviceMap[apt.serviceId]?.name || '';
      const matchesSearch = 
        apt.customerName.toLowerCase().includes(searchQuery.toLowerCase()) ||
        apt.customerEmail.toLowerCase().includes(searchQuery.toLowerCase()) ||
        srvName.toLowerCase().includes(searchQuery.toLowerCase()) ||
        apt.customerPhone.includes(searchQuery);

      const matchesStatus = statusFilter === 'all' || apt.status === statusFilter;
      const matchesDate = !dateFilter || apt.date === dateFilter;
      const matchesStaff = staffFilter === 'all' || apt.staffId === staffFilter;

      return matchesSearch && matchesStatus && matchesDate && matchesStaff;
    }).sort((a, b) => {
      // Sort closest date first
      return new Date(`${a.date} ${a.timeSlot}`).getTime() - new Date(`${b.date} ${b.timeSlot}`).getTime();
    });
  }, [appointments, searchQuery, statusFilter, dateFilter, staffFilter, serviceMap]);

  // Handle deleting/cancelling
  const handleCancelBooking = async (id) => {
    if (!window.confirm('Are you sure you want to cancel this booking reservation?')) {
      return;
    }
    
    try {
      const response = await fetch(`/api/appointments/${id}`, {
        method: 'DELETE'
      });
      if (response.ok) {
        onBookingDeleted(id);
      }
    } catch (err) {
      alert('Failed to cancel appointment on server');
    }
  };

  // Open Template modal
  const openMailDialog = (apt) => {
    setActiveMailApt(apt);
    const primaryReminder = emailTemplates.find(t => t.type === 'reminder') || emailTemplates[0];
    setSelectedMailTemplateId(primaryReminder?.id || '');
    setMailSuccessAlert('');
  };

  // Submit manual template simulation
  const handleSendManualMail = async () => {
    if (!activeMailApt || !selectedMailTemplateId) return;
    setMailTriggering(true);
    setMailSuccessAlert('');

    try {
      const response = await fetch('/api/appointments/trigger-email', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          appointmentId: activeMailApt.id,
          templateId: selectedMailTemplateId
        })
      });

      const data = await response.json();
      if (!response.ok) throw new Error(data.error);

      setMailSuccessAlert(`Simulated mail of type "${data.log.subject}" sent to ${activeMailApt.customerEmail} successfully.`);
      
      const updatedApt = { ...activeMailApt, reminderSent: true, reminderTemplateId: selectedMailTemplateId };
      onBookingUpdated(updatedApt);
    } catch (err) {
      alert('Error triggering email simulation: ' + err.message);
    } finally {
      setMailTriggering(false);
    }
  };

  // Inline save update status/staff re-assignment helper
  const handleInlineSave = async (apt, updatedFields) => {
    try {
      const response = await fetch('/api/appointments', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          appointment: { ...apt, ...updatedFields }
        })
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error);
      onBookingUpdated(data.appointment);
    } catch (err) {
      alert(err.message);
    }
  };

  return (
    <div className="space-y-6">
      {/* Booking list layout controls */}
      <div className="grid md:grid-cols-12 gap-3 items-center">
        {/* Search */}
        <div className="md:col-span-4 relative">
          <Search className="absolute left-3 top-3 w-4 h-4 text-slate-400" />
          <input
            id="book-mgmt-search"
            type="text"
            placeholder="Search details, clients or services..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-9 pr-3 py-2.5 text-xs bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:border-primary focus:bg-white focus:ring-2 focus:ring-secondary/50 transition-all font-medium"
          />
        </div>

        {/* Status Filter */}
        <div className="md:col-span-2.5 flex items-center gap-1.5 bg-slate-50 border border-slate-200 rounded-lg px-2.5 py-2.5">
          <Filter className="w-3.5 h-3.5 text-slate-400" />
          <select
            id="book-status-filter"
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="bg-transparent text-xs text-slate-700 w-full focus:outline-none font-medium cursor-pointer"
          >
            <option value="all">Status: All Statuses</option>
            <option value="pending">Pending</option>
            <option value="confirmed">Confirmed</option>
            <option value="completed">Completed</option>
            <option value="cancelled">Cancelled</option>
          </select>
        </div>

        {/* Staff Filter */}
        <div className="md:col-span-2.5 flex items-center gap-1.5 bg-slate-50 border border-slate-200 rounded-lg px-2.5 py-2.5">
          <User className="w-3.5 h-3.5 text-slate-400 font-bold" />
          <select
            id="book-staff-filter"
            value={staffFilter}
            onChange={(e) => setStaffFilter(e.target.value)}
            className="bg-transparent text-xs text-slate-700 w-full focus:outline-none font-medium cursor-pointer"
          >
            <option value="all">Staff: All Specialists</option>
            {staff.map(s => (
              <option key={s.id} value={s.id}>{s.name}</option>
            ))}
          </select>
        </div>

        {/* Date Filter */}
        <div className="md:col-span-2 flex items-center gap-1.5 bg-slate-50 border border-slate-200 rounded-lg px-2.5 py-2.5">
          <Calendar className="w-3.5 h-3.5 text-slate-400" />
          <input
            id="book-date-filter"
            type="date"
            value={dateFilter}
            onChange={(e) => setDateFilter(e.target.value)}
            className="bg-transparent text-xs text-slate-705 w-full focus:outline-none font-medium cursor-pointer"
          />
        </div>

        {/* Staff book customer shortcut */}
        <div className="md:col-span-1">
          <button
            id="staff-create-appt-btn"
            onClick={onAddBookingClick}
            className="w-full bg-primary border border-primary hover:bg-primary/95 text-white rounded-lg py-2.5 text-xs font-bold transition flex items-center justify-center shadow-sm cursor-pointer"
            title="Book Appt manually"
          >
            <span>+ Book</span>
          </button>
        </div>
      </div>

      {/* Grid listing table */}
      <div className="overflow-x-auto bg-white rounded-xl border border-slate-200 shadow-sm">
        <table className="w-full text-left border-collapse text-xs">
          <thead>
            <tr className="bg-slate-50/75 border-b border-slate-200 text-[10px] text-slate-550 font-bold uppercase tracking-wider">
              <th className="p-4">Customer Details</th>
              <th className="p-4">Service Required</th>
              <th className="p-4">Date & Timing</th>
              <th className="p-4 text-center">Status & Staff</th>
              <th className="p-4 text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {filteredAppointments.map((apt) => {
               const srv = serviceMap[apt.serviceId];
               return (
                <tr key={apt.id} className="hover:bg-slate-50/30 transition">
                  <td className="p-4 text-slate-850">
                    <div className="font-bold text-slate-900 text-sm flex items-center gap-1.5">
                      <span>{apt.customerName}</span>
                      {apt.notes && (
                        <span 
                          className="w-1.5 h-1.5 bg-amber-500 rounded-full cursor-help animate-pulse"
                          title={`Notes: ${apt.notes}`}
                        ></span>
                      )}
                    </div>
                    <div className="text-slate-500 text-[11px] space-y-0.5 mt-1 font-medium">
                      <div className="flex items-center gap-1.5">
                        <Mail className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                        <span className="truncate max-w-[150px]" title={apt.customerEmail}>{apt.customerEmail}</span>
                      </div>
                      {apt.customerPhone && (
                        <div className="flex items-center gap-1.5">
                          <Phone className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                          <span>{apt.customerPhone}</span>
                        </div>
                      )}
                    </div>
                  </td>

                  <td className="p-4">
                    <span className="font-bold text-slate-900 block text-xs">{srv ? srv.name : 'Unknown Service'}</span>
                    <span className="text-slate-500 text-[10px] font-medium block mt-1">{srv ? `${srv.durationMinutes} Min Duration • ${formatUSD(srv.price, settings.currency)}` : ''}</span>
                  </td>

                  <td className="p-4">
                    <div className="space-y-1">
                      <div>
                        <span className="text-[9px] uppercase font-bold text-slate-400 tracking-wider block">Scheduled for</span>
                        <div className="flex items-center gap-1.5 font-bold text-slate-900 text-xs mt-0.5">
                          <Calendar className="w-3.5 h-3.5 text-primary shrink-0" />
                          <span>{formatHumanDate(apt.date)}</span>
                        </div>
                        <div className="flex items-center gap-1.5 text-slate-650 font-semibold text-[11px] mt-0.5">
                          <Clock className="w-3.5 h-3.5 text-slate-500 shrink-0" />
                          <span>{apt.timeSlot}</span>
                        </div>
                      </div>
                      
                      {apt.createdAt && (
                        <div className="pt-1.5 border-t border-slate-100 mt-1.5">
                          <span className="text-[9px] uppercase font-bold text-slate-500 tracking-wider block">Booked on</span>
                          <span className="text-slate-550 text-[10px] font-medium block mt-0.5 animate-fade-in">
                            {formatHumanDateTime(apt.createdAt)}
                          </span>
                        </div>
                      )}
                    </div>
                  </td>

                  <td className="p-4 text-center">
                    <div className="flex flex-col items-center gap-1.5">
                      {/* State Modifier Dropdown Selection */}
                      <select
                        value={apt.status || 'confirmed'}
                        onChange={(e) => handleInlineSave(apt, { status: e.target.value })}
                        className={`text-[9px] font-bold p-1 rounded-md border focus:outline-none cursor-pointer uppercase tracking-wider ${
                          apt.status === 'confirmed'
                            ? 'bg-emerald-50 text-emerald-700 border-emerald-250'
                            : apt.status === 'pending'
                            ? 'bg-amber-50 text-amber-750 border-amber-250'
                            : apt.status === 'completed'
                            ? 'bg-secondary/30 text-primary border-secondary font-bold'
                            : 'bg-slate-100 text-slate-550 border-slate-250'
                        }`}
                      >
                        <option value="pending">Pending</option>
                        <option value="confirmed">Confirmed</option>
                        <option value="completed">Completed</option>
                        <option value="cancelled">Cancelled</option>
                      </select>

                      {/* Staff Assign Dropdown Selection */}
                      <select
                        value={apt.staffId || ''}
                        onChange={(e) => handleInlineSave(apt, { staffId: e.target.value })}
                        className="text-[10px] font-semibold p-1 px-2 rounded-md border border-slate-200 bg-white text-slate-650 focus:outline-none cursor-pointer text-center w-36"
                      >
                        <option value="">No Specialist Assigned</option>
                        {staff.filter(s => s.active).map(s => (
                          <option key={s.id} value={s.id}>{s.name} ({s.role})</option>
                        ))}
                      </select>
                      
                      {apt.reminderSent && (
                        <span className="text-[9px] font-bold text-primary bg-secondary/30 px-2 py-0.5 rounded border border-secondary flex items-center gap-0.5 uppercase tracking-wide">
                          <MailCheck className="w-3 h-3 text-primary" />
                          <span>Emailed</span>
                        </span>
                      )}
                    </div>
                  </td>

                  <td className="p-4 text-right">
                    <div className="flex justify-end gap-1.5 items-center">
                      <button
                        title="Manually dispatch custom email template sim"
                        onClick={() => openMailDialog(apt)}
                        className="p-1.5 bg-white border border-slate-200 text-slate-600 hover:text-primary hover:border-primary/50 hover:bg-secondary/15 rounded-lg transition cursor-pointer"
                      >
                        <Mail className="w-4 h-4" />
                      </button>

                      <button
                        title="Delete booking"
                        id={`cancel-btn-${apt.id}`}
                        onClick={() => handleCancelBooking(apt.id)}
                        className="p-1.5 bg-white border border-rose-250 text-rose-500 hover:bg-rose-50 hover:text-rose-600 hover:border-rose-350 rounded-lg transition cursor-pointer"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </td>
                </tr>
              );
            })}
            {filteredAppointments.length === 0 && (
              <tr>
                <td colSpan={5} className="p-10 text-center text-slate-400 font-medium pb-12 pt-12">
                  No matching active bookings found in the secure log.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Manual Template Simulation Popup */}
      {activeMailApt && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl border border-slate-205 shadow-2xl max-w-lg w-full p-6 space-y-4 animate-fade-in">
            <div className="flex justify-between items-center pb-3 border-b border-slate-150">
              <h4 className="font-display font-bold text-slate-900 text-sm">Send Professional Email Template</h4>
              <button 
                onClick={() => setActiveMailApt(null)} 
                className="text-slate-400 hover:text-slate-700 text-xl font-bold cursor-pointer"
              >
                &times;
              </button>
            </div>

            {mailSuccessAlert ? (
              <div className="bg-emerald-50 text-emerald-900 border border-emerald-200 p-4 rounded-xl text-xs space-y-3 shadow-inner">
                <p className="font-semibold leading-relaxed">{mailSuccessAlert}</p>
                <button 
                  onClick={() => setActiveMailApt(null)}
                  className="bg-emerald-600 border border-emerald-600 font-bold hover:bg-emerald-700 text-white px-4 py-2 rounded-lg text-[11px] shadow-sm cursor-pointer"
                >
                  Close Window
                </button>
              </div>
            ) : (
              <div className="space-y-4">
                <div>
                  <p className="text-xs text-slate-550">
                    Recipient Client: <strong className="text-slate-800">{activeMailApt.customerName} ({activeMailApt.customerEmail})</strong>
                  </p>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1.5 uppercase tracking-wide text-[10px]">Select Template Definition</label>
                  <select
                    id="manual-mail-template-select"
                    value={selectedMailTemplateId}
                    onChange={(e) => setSelectedMailTemplateId(e.target.value)}
                    className="w-full border border-slate-250 bg-slate-50 rounded-lg p-2.5 text-xs font-semibold focus:bg-white focus:border-primary focus:outline-none focus:ring-2 focus:ring-secondary/50 cursor-pointer"
                  >
                    {emailTemplates.map(t => (
                      <option key={t.id} value={t.id}>{t.name} ({t.type === 'confirmation' ? 'Confirmation' : 'Reminder'})</option>
                    ))}
                  </select>
                </div>

                <div className="bg-slate-50 p-4 rounded-xl border border-slate-200 space-y-1.5 shadow-[0_1px_2px_rgba(0,0,0,0.01)]">
                  <span className="text-[10px] text-slate-400 block font-bold uppercase tracking-widest">Live Content Preview</span>
                  {(() => {
                    const chosen = emailTemplates.find(t => t.id === selectedMailTemplateId);
                    if (!chosen) return null;
                    const sName = serviceMap[activeMailApt.serviceId]?.name || 'Premium Service';
                    return (
                      <div className="text-[11px] text-slate-600 mt-1 max-h-[140px] overflow-y-auto space-y-2 leading-relaxed">
                        <div>
                          <strong className="text-slate-700 font-bold">Subject:</strong> {chosen.subject.replace('{service_name}', sName).replace('{business_name}', 'My Business Name')}
                        </div>
                        <div className="whitespace-pre-line border-t border-slate-200 pt-2 font-medium">
                          {chosen.body
                            .replace(/{customer_name}/g, activeMailApt.customerName)
                            .replace(/{appointment_date}/g, activeMailApt.date)
                            .replace(/{appointment_time}/g, activeMailApt.timeSlot)
                            .replace(/{service_name}/g, sName)
                            .replace(/{business_name}/g, 'My Business Name')
                            .replace(/{notes}/g, activeMailApt.notes || '(None)')}
                        </div>
                      </div>
                    );
                  })()}
                </div>

                <div className="flex justify-end gap-2 pt-2 border-t border-slate-150">
                  <button
                    onClick={() => setActiveMailApt(null)}
                    className="px-4 py-2 border border-slate-250 hover:bg-slate-50 text-slate-700 rounded-lg text-xs font-bold transition cursor-pointer"
                  >
                    Cancel
                  </button>
                  <button
                    id="confirm-send-mail-btn"
                    onClick={handleSendManualMail}
                    disabled={mailTriggering || !selectedMailTemplateId}
                    className="bg-primary border border-primary text-white hover:bg-primary/95 rounded-lg px-4 py-2 text-xs font-bold transition flex items-center gap-1.5 shadow-md shadow-primary/10 cursor-pointer"
                  >
                    <Send className="w-3.5 h-3.5 text-white/90" />
                    <span>{mailTriggering ? 'Simulating Dispatch...' : 'Dispatch Simulated Email'}</span>
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
