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
  // Pagination states
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(10);

  // Filter setters that reset pagination back to active step 1
  const handleSearchChange = (val) => {
    setSearchQuery(val);
    setCurrentPage(1);
  };
  const handleStatusFilterChange = (val) => {
    setStatusFilter(val);
    setCurrentPage(1);
  };
  const handleStaffFilterChange = (val) => {
    setStaffFilter(val);
    setCurrentPage(1);
  };
  const handleDateFilterChange = (val) => {
    setDateFilter(val);
    setCurrentPage(1);
  };

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
  // Open Template modal
  const openMailDialog = (apt) => {
    setActiveMailApt(apt);
    const primaryReminder = emailTemplates.find(t => t.type === 'reminder') || emailTemplates[0];
    setSelectedMailTemplateId(primaryReminder?.id || '');
    setMailSuccessAlert('');
  };
  const API_URL = import.meta.env.VITE_API_URL || '';
  // Send manual template 
  const handleSendManualMail = async () => {
    if (!activeMailApt || !selectedMailTemplateId) return;
    setMailTriggering(true);
    setMailSuccessAlert('');

    try {
      const response = await fetch(`${API_URL}/api/appointments/trigger-email`, {
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
      alert('Error triggering email: ' + err.message);
    } finally {
      setMailTriggering(false);
    }
  };
  // Pagination bounds & calculation
  const totalItems = filteredAppointments.length;
  const totalPages = Math.ceil(totalItems / itemsPerPage);
  const activePage = Math.min(currentPage, Math.max(1, totalPages));
  const startIndex = (activePage - 1) * itemsPerPage;

  const visibleAppointments = useMemo(() => {
    return filteredAppointments.slice(startIndex, startIndex + itemsPerPage);
  }, [filteredAppointments, startIndex, itemsPerPage]);

  // Handle deleting/cancelling single appointment
  const handleCancelBooking = async (id) => {
    if (!window.confirm('Are you sure you want to cancel this booking reservation?')) {
      return;
    }

    try {
      const response = await fetch(`${API_URL}/api/appointments/${id}`, {
        method: 'DELETE'
      });
      if (response.ok) {
        onBookingDeleted(id);
      }
    } catch (err) {
      alert('Failed to cancel appointment on server');
    }
  };

  // Inline save update status/staff re-assignment helper
  const handleInlineSave = async (apt, updatedFields) => {
    try {
      const response = await fetch(`${API_URL}/api/appointments`, {
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
      <div className="grid md:grid-cols-12 gap-3.5 items-center">
        {/* Search */}
        <div className="md:col-span-4 relative group">
          <Search className="absolute left-3.5 top-[13px] w-4 h-4 text-slate-400 group-focus-within:text-primary transition-colors" />
          <input
            id="book-mgmt-search"
            type="text"
            placeholder="Search bookings, customer details or hair trials..."
            value={searchQuery}
            onChange={(e) => handleSearchChange(e.target.value)}
            className="w-full pl-10 pr-3.5 py-3 text-xs bg-white/70 border border-slate-200/80 rounded-xl focus:outline-none focus:border-primary focus:bg-white focus:ring-4 focus:ring-primary/5 transition-all font-medium placeholder:text-slate-400 shadow-3xs"
          />
        </div>

        {/* Status Filter */}
        <div className="md:col-span-2 flex items-center gap-2 bg-white/70 border border-slate-200/80 rounded-xl px-3 py-3 shadow-3xs hover:border-slate-300 transition-all">
          <Filter className="w-3.5 h-3.5 text-slate-400 shrink-0" />
          <select
            id="book-status-filter"
            value={statusFilter}
            onChange={(e) => handleStatusFilterChange(e.target.value)}
            className="bg-transparent text-xs text-slate-705 w-full focus:outline-none font-bold cursor-pointer"
          >
            <option value="all">Status: All States</option>
            <option value="pending">Pending</option>
            <option value="confirmed">Confirmed</option>
            <option value="completed">Completed</option>
            <option value="cancelled">Cancelled</option>
          </select>
        </div>

        {/* Staff Filter */}
        <div className="md:col-span-2 flex items-center gap-2 bg-white/70 border border-slate-200/80 rounded-xl px-3 py-3 shadow-3xs hover:border-slate-300 transition-all">
          <User className="w-3.5 h-3.5 text-slate-400 font-bold shrink-0" />
          <select
            id="book-staff-filter"
            value={staffFilter}
            onChange={(e) => handleStaffFilterChange(e.target.value)}
            className="bg-transparent text-xs text-slate-705 w-full focus:outline-none font-bold cursor-pointer"
          >
            <option value="all">Staff: All Experts</option>
            {staff.map(s => (
              <option key={s.id} value={s.id}>{s.name} ({s.role})</option>
            ))}
          </select>
        </div>

        {/* Date Filter */}
        <div className="md:col-span-2 flex items-center gap-2 bg-white/70 border border-slate-200/80 rounded-xl px-3 py-2.5 shadow-3xs hover:border-slate-300 transition-all">
          <Calendar className="w-3.5 h-3.5 text-slate-400 shrink-0" />
          <input
            id="book-date-filter"
            type="date"
            value={dateFilter}
            onChange={(e) => handleDateFilterChange(e.target.value)}
            className="bg-transparent text-xs text-slate-705 w-full focus:outline-none font-bold cursor-pointer"
          />
        </div>

        {/* Staff book customer shortcut with dynamic hover scale */}
        <div className="md:col-span-1">
          <button
            id="staff-create-appt-btn"
            onClick={onAddBookingClick}
            className="w-full bg-primary hover:bg-primary/95 text-white rounded-xl py-3 text-xs font-extrabold transition-all duration-200 flex items-center justify-center gap-1.5 shadow-md shadow-primary/15 cursor-pointer hover:scale-[1.03] active:scale-95"
            title="Book Appt manually"
          >
            <span> Add </span>
          </button>
        </div>
      </div>

      {/* Grid listing table container */}
      <div className="bg-white rounded-2xl border border-slate-200/80 shadow-[0_4px_20px_rgba(15,23,42,0.03)] overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="bg-slate-50/60 border-b border-slate-200/70 text-[10px] text-slate-400 font-extrabold uppercase tracking-widest">
                <th className="p-4 tracking-wider">Customer Details</th>
                <th className="p-4 tracking-wider">Service Required</th>
                <th className="p-4 tracking-wider">Date & Timing</th>
                <th className="p-4 text-center tracking-wider">Status & Staff</th>
                <th className="p-4 text-right tracking-wider">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100/70">
              {visibleAppointments.map((apt) => {
                const srv = serviceMap[apt.serviceId];
                return (
                  <tr key={apt.id} className="hover:bg-slate-50/40 transition-colors duration-150">
                    <td className="p-4 text-slate-800">
                      <div className="font-bold text-slate-900 text-sm flex items-center gap-1.5 font-display tracking-tight">
                        <span>{apt.customerName}</span>
                        {apt.notes && (
                          <span
                            className="inline-block w-2.5 h-2.5 bg-[#3a4f99] rounded-full cursor-help animate-pulse border-2 border-white shadow-2xs"
                            title={`Notes: ${apt.notes}`}
                          ></span>
                        )}
                      </div>
                      <div className="text-slate-500 text-[11px] space-y-0.5 mt-1 font-medium leading-normal">
                        <div className="flex items-center gap-1.5">
                          <Mail className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                          <span className="truncate max-w-[150px] text-slate-600" title={apt.customerEmail}>{apt.customerEmail}</span>
                        </div>
                        {apt.customerPhone && (
                          <div className="flex items-center gap-1.5">
                            <Phone className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                            <span className="text-slate-600">{apt.customerPhone}</span>
                          </div>
                        )}
                      </div>
                    </td>

                    <td className="p-4">
                      <span className="font-bold text-slate-900 block text-xs tracking-tight">{srv ? srv.name : 'Unknown Service'}</span>
                      <span className="text-slate-500 text-[10.5px] font-semibold block mt-1">{srv ? `${srv.durationMinutes} min • ${formatUSD(srv.price, settings.currency)}` : ''}</span>
                    </td>

                    <td className="p-4 col-span-1">
                      <div className="space-y-1">
                        <div>
                          <div className="flex items-center gap-1.5 font-bold text-slate-900 text-xs text-gradient">
                            <Calendar className="w-3.5 h-3.5 text-primary shrink-0" />
                            <span>{formatHumanDate(apt.date)}</span>
                          </div>
                          <div className="flex items-center gap-1.5 text-slate-600 font-semibold text-[11px] mt-1">
                            <Clock className="w-3.5 h-3.5 text-slate-450 shrink-0" />
                            <span>{apt.timeSlot}</span>
                          </div>
                        </div>

                        {apt.createdAt && (
                          <div className="pt-1.5 border-t border-slate-100 mt-1.5">
                            <span className="text-[10px] text-slate-400 font-bold block">Booked: {formatHumanDateTime(apt.createdAt)}</span>
                          </div>
                        )}
                      </div>
                    </td>

                    <td className="p-4 text-center">
                      <div className="flex flex-col items-center gap-2">
                        {/* State Modifier Dropdown Selection */}
                        <div className="relative">
                          <select
                            value={apt.status || 'confirmed'}
                            onChange={(e) => handleInlineSave(apt, { status: e.target.value })}
                            className={`text-[10px] font-extrabold px-3 py-1.5 rounded-lg border focus:outline-none cursor-pointer uppercase tracking-wider transition-all shadow-2xs ${apt.status === 'confirmed'
                              ? 'bg-emerald-50 text-emerald-700 border-emerald-200 hover:bg-emerald-100/60'
                              : apt.status === 'pending'
                                ? 'bg-[#3a4f99]/10 text-[#3a4f99] border-[#3a4f99]/20 hover:bg-[#3a4f99]/20'
                                : apt.status === 'completed'
                                  ? 'bg-purple-50 text-purple-700 border-purple-200 font-extrabold'
                                  : 'bg-slate-100 text-slate-550 border-slate-200 hover:bg-slate-150/40'
                              }`}
                          >
                            <option value="pending">Pending</option>
                            <option value="confirmed">Confirmed</option>
                            <option value="completed">Completed</option>
                            <option value="cancelled">Cancelled</option>
                          </select>
                        </div>

                        {/* Staff Assign Dropdown Selection */}
                        <select
                          value={apt.staffId || ''}
                          onChange={(e) => handleInlineSave(apt, { staffId: e.target.value })}
                          className="text-[10.5px] font-bold py-1 px-2.5 rounded-lg border border-slate-250 bg-white text-slate-700 focus:outline-none cursor-pointer text-center w-40 hover:border-slate-350 transition-all shadow-3xs"
                        >
                          <option value="">No Assignment</option>
                          {staff.filter(s => s.active).map(s => (
                            <option key={s.id} value={s.id}>{s.name}</option>
                          ))}
                        </select>

                        {apt.reminderSent && (
                          <span className="text-[9px] font-extrabold text-primary bg-secondary/35 px-2.5 py-0.5 rounded-full border border-secondary/80 flex items-center gap-0.5 uppercase tracking-widest font-mono">
                            <MailCheck className="w-3 h-3 text-primary" />
                            <span>EMAILED</span>
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
                          type="button"
                          title="Cancel appointment"
                          id={`cancel-btn-${apt.id}`}
                          onClick={() => handleCancelBooking(apt.id)}
                          className="p-2 bg-white border border-rose-200 text-rose-500 hover:bg-rose-50 hover:text-rose-600 hover:border-rose-350 rounded-xl transition duration-150 cursor-pointer shadow-3xs"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
              {visibleAppointments.length === 0 && (
                <tr>
                  <td colSpan={5} className="p-10 text-center text-slate-450 font-bold tracking-tight pb-16 pt-16">
                    No active bookings match other filters in the register.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {/* Email Template Popup */}
        {activeMailApt && (
          <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
            <div className="bg-white rounded-2xl border border-slate-205 shadow-2xl max-w-lg w-full p-6 space-y-4 animate-fade-in">
              <div className="flex justify-between items-center pb-3 border-b border-slate-150">
                <h4 className="font-display font-bold text-slate-900 text-sm">Send Email</h4>
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
                      <span>{mailTriggering ? 'Sending..' : 'Send'}</span>
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}


        {/* PAGINATION CONTROL FOOTER */}
        {totalItems > 0 && (
          <div className="flex flex-col sm:flex-row items-center justify-between gap-4 bg-slate-50/50 hover:bg-slate-50/80 transition-all px-5 py-4 border-t border-slate-200/70 text-slate-500 text-xs">
            <div className="flex flex-wrap items-center gap-3">
              <span className="text-slate-400 font-extrabold uppercase tracking-wider text-[10px] select-none font-mono font-bold">Rows per page:</span>
              <select
                value={itemsPerPage}
                onChange={(e) => {
                  setItemsPerPage(Number(e.target.value));
                  setCurrentPage(1);
                }}
                className="bg-white border border-slate-200 rounded-lg px-2 py-1.5 text-xs font-bold text-slate-705 cursor-pointer focus:ring-4 focus:ring-primary/5 focus:border-primary focus:outline-none shadow-3xs"
              >
                <option value={5}>5 entries</option>
                <option value={10}>10 entries</option>
                <option value={20}>20 entries</option>
                <option value={50}>50 entries</option>
              </select>
              <span className="font-bold text-slate-500">
                Showing <strong className="text-slate-800">{startIndex + 1}</strong> to <strong className="text-slate-800">{Math.min(startIndex + itemsPerPage, totalItems)}</strong> of <strong className="text-slate-800">{totalItems}</strong> entries
              </span>
            </div>

            <div className="flex items-center gap-1.5 select-none font-sans">
              <button
                type="button"
                onClick={() => setCurrentPage(1)}
                disabled={activePage === 1}
                className="p-2 bg-white border border-slate-200/80 hover:border-slate-350 hover:bg-slate-50 rounded-xl text-slate-605 disabled:opacity-45 disabled:hover:bg-white disabled:cursor-not-allowed transition duration-150 text-xs font-bold shadow-3xs cursor-pointer"
                title="First Page"
              >
                &lsaquo;&lsaquo;
              </button>
              <button
                type="button"
                onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
                disabled={activePage === 1}
                className="p-2 bg-white border border-slate-200/80 hover:border-slate-350 hover:bg-slate-50 rounded-xl text-slate-605 disabled:opacity-45 disabled:hover:bg-white disabled:cursor-not-allowed transition duration-150 text-xs font-bold shadow-3xs cursor-pointer"
                title="Previous Page"
              >
                &lsaquo;
              </button>

              <div className="flex items-center gap-1">
                {(() => {
                  const pages = [];
                  const maxButtons = 5;
                  let startPage = Math.max(1, activePage - Math.floor(maxButtons / 2));
                  let endPage = Math.min(totalPages, startPage + maxButtons - 1);

                  if (endPage - startPage + 1 < maxButtons) {
                    startPage = Math.max(1, endPage - maxButtons + 1);
                  }

                  for (let p = startPage; p <= endPage; p++) {
                    pages.push(
                      <button
                        key={p}
                        type="button"
                        onClick={() => setCurrentPage(p)}
                        className={`w-8 h-8 rounded-xl text-xs font-bold transition duration-150 flex items-center justify-center cursor-pointer ${p === activePage
                          ? 'bg-primary text-white shadow-md shadow-primary/15 font-bold'
                          : 'bg-white border border-slate-200/80 hover:bg-slate-50 hover:border-slate-350 text-slate-750 shadow-3xs'
                          }`}
                      >
                        {p}
                      </button>
                    );
                  }
                  return pages;
                })()}
              </div>

              <button
                type="button"
                onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}
                disabled={activePage === totalPages}
                className="p-2 bg-white border border-slate-200/80 hover:border-slate-350 hover:bg-slate-50 rounded-xl text-slate-605 disabled:opacity-45 disabled:hover:bg-white disabled:cursor-not-allowed transition duration-150 text-xs font-bold shadow-3xs cursor-pointer"
                title="Next Page"
              >
                &rsaquo;
              </button>
              <button
                type="button"
                onClick={() => setCurrentPage(totalPages)}
                disabled={activePage === totalPages}
                className="p-2 bg-white border border-slate-200/80 hover:border-slate-350 hover:bg-slate-50 rounded-xl text-slate-605 disabled:opacity-45 disabled:hover:bg-white disabled:cursor-not-allowed transition duration-150 text-xs font-bold shadow-3xs cursor-pointer"
                title="Last Page"
              >
                &rsaquo;&rsaquo;
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
