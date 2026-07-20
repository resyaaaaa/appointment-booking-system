import React, { useState, useMemo } from 'react';
import { Calendar, Clock, User, Phone, Mail, FileText, CheckCircle2, ChevronRight, ChevronLeft, Plus, Users, Award } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { generateAvailableSlots, formatUSD, DAYS_OF_WEEK, getBlockedReason, formatDateStr, formatHumanDate } from '../utils';
const API_URL = (import.meta.env.VITE_API_URL || '').replace(/\/$/, '');

export default function WizardBooker({
  services,
  appointments,
  availability,
  customBlocks,
  onBookingComplete,
  staffMode = false,
  staff = [],
  settings = {},
  currentUser = null
}) {
  const [step, setStep] = useState(1);
  const [selectedServiceId, setSelectedServiceId] = useState('');
  const [selectedDate, setSelectedDate] = useState('');
  const [selectedSlot, setSelectedSlot] = useState('');
  const [selectedStaffId, setSelectedStaffId] = useState('');

  // Passenger Form State
  const [customerName, setCustomerName] = useState('');
  const [customerEmail, setCustomerEmail] = useState('');
  const [customerPhone, setCustomerPhone] = useState('');
  const [customerNotes, setCustomerNotes] = useState('');

  // Auto-fill customer details from account session
  React.useEffect(() => {
    if (currentUser && currentUser.role === 'customer') {
      setCustomerName(currentUser.name || '');
      setCustomerEmail(currentUser.email || '');
      setCustomerPhone(currentUser.phone || '');
    }
  }, [currentUser]);

  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [bookingSuccess, setBookingSuccess] = useState(null);

  // Month pager state for inline custom calendar
  const [currentMonth, setCurrentMonth] = useState(new Date());

  const activeServices = useMemo(() => services.filter(s => s.isActive), [services]);

  const selectedService = useMemo(() =>
    services.find(s => s.id === selectedServiceId),
    [services, selectedServiceId]
  );

  // Date list generation for local calendar month display
  const daysInMonth = useMemo(() => {
    const year = currentMonth.getFullYear();
    const month = currentMonth.getMonth();
    const firstDay = new Date(year, month, 1);
    const lastDay = new Date(year, month + 1, 0);

    const results = [];

    // Add prefix padding days from previous month
    const startPadding = firstDay.getDay();
    for (let i = startPadding; i > 0; i--) {
      results.push(new Date(year, month, 1 - i));
    }

    // Add actual month days
    const totalDays = lastDay.getDate();
    for (let d = 1; d <= totalDays; d++) {
      results.push(new Date(year, month, d));
    }

    return results;
  }, [currentMonth]);

  const monthLabel = useMemo(() => {
    return currentMonth.toLocaleString('en-US', { month: 'long', year: 'numeric' });
  }, [currentMonth]);

  const handleNextMonth = () => {
    setCurrentMonth(new Date(currentMonth.getFullYear(), currentMonth.getMonth() + 1, 1));
  };

  const handlePrevMonth = () => {
    setCurrentMonth(new Date(currentMonth.getFullYear(), currentMonth.getMonth() - 1, 1));
  };

  // Generate slots for chosen date
  const availableSlots = useMemo(() => {
    if (!selectedDate || !selectedService) return [];
    return generateAvailableSlots(
      selectedDate,
      appointments,
      availability,
      customBlocks,
      selectedService.durationMinutes,
      selectedStaffId,
      staff,
      services
    );
  }, [selectedDate, selectedService, appointments, availability, customBlocks, selectedStaffId, staff, services]);

  // Handle individual date click
  const handleDateClick = (date) => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    if (date < today) return; // Cannot book past dates

    const dateStr = formatDateStr(date);

    // Find if closed on this day of week
    const dow = date.getDay();
    const rule = availability.find(r => r.dayOfWeek === dow);
    if (!rule || !rule.isWorkingDay) return;

    // Check custom block
    const isFullBlock = customBlocks.some(b =>
      b.date === dateStr && (
        !b.startTime ||
        b.startTime === '' ||
        b.startTime === '00:00' ||
        (b.startTime === '00:00' && b.endTime === '23:59') ||
        (b.startTime === '00:00' && b.endTime === '24:00') ||
        b.endTime === '23:59' ||
        b.endTime === '24:00'
      )
    );
    if (isFullBlock) return;

    setSelectedDate(dateStr);
    setSelectedSlot(''); // Reset timeslot
  };

  const handleServiceSelect = (id) => {
    setSelectedServiceId(id);
    setSelectedSlot('');
    setStep(2);
  };

  const handleBookingSubmit = async (e) => {
    e.preventDefault();
    if (!customerName || !customerEmail) {
      setErrorMsg('Name and email are mandatory.');
      return;
    }

    setLoading(true);
    setErrorMsg('');

    // If "Any Professional" is selected, dynamically assign the first active and free professional
    let finalStaffId = selectedStaffId;
    if (!finalStaffId) {
      const activeStaff = staff.filter(s => s.active);
      const freeStaff = activeStaff.find(s => {
        return !appointments.some(a =>
          a.date === selectedDate &&
          a.timeSlot === selectedSlot &&
          a.staffId === s.id &&
          (a.status === 'confirmed' || a.status === 'pending')
        );
      });
      if (freeStaff) {
        finalStaffId = freeStaff.id;
      } else if (activeStaff.length > 0) {
        finalStaffId = activeStaff[0].id;
      }
    }

    const payload = {
      appointment: {
        customerName,
        customerEmail,
        customerPhone,
        date: selectedDate,
        timeSlot: selectedSlot,
        serviceId: selectedServiceId,
        staffId: finalStaffId,
        notes: customerNotes,
        status: 'confirmed'
      }
    };
    try {
      const response = await fetch(`${API_URL}/api/appointments`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || 'Server rejected the booking.');
      }

      setBookingSuccess(data.appointment);
      onBookingComplete(data.appointment);
      setStep(4);
    } catch (err) {
      setErrorMsg(err.message || 'An error occurred while scheduling appointment.');
    } finally {
      setLoading(false);
    }
  };

  const resetWizardAll = () => {
    setSelectedServiceId('');
    setSelectedDate('');
    setSelectedSlot('');
    setSelectedStaffId('');
    setCustomerName('');
    setCustomerEmail('');
    setCustomerPhone('');
    setCustomerNotes('');
    setErrorMsg('');
    setBookingSuccess(null);
    setStep(1);
  };

  return (
    <div className="bg-white rounded-3xl border border-slate-200/90 shadow-[0_10px_30px_rgba(15,23,42,0.04)] p-6 sm:p-8 max-w-3xl mx-auto backdrop-blur-3xl">
      {/* Wizard Step Progression Timeline */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-100 pb-5 mb-6">
        <div>
          <h3 className="font-display font-bold text-slate-900 text-lg flex items-center gap-2">
            {staffMode ? (
              <span className="bg-[#291100]/10 text-[#291100] text-[9px] uppercase font-bold tracking-widest px-2.5 py-1 rounded-full border border-[#291100]/20">
                Core Admin Override
              </span>
            ) : (
              <span className="bg-secondary text-primary text-[9px] uppercase font-bold tracking-widest px-2.5 py-1 rounded-full border border-secondary">
                Secure Client Portal
              </span>
            )}
            <span>Schedule Appointment</span>
          </h3>
          <p className="text-xs text-slate-500 mt-1 font-semibold">
            {step === 1 && 'Step 1: Pick service from our catalog'}
            {step === 2 && 'Step 2: Select available session day & hourly slot'}
            {step === 3 && 'Step 3: Provide client details for automatic confirmations'}
            {step === 4 && 'Complete: Success confirmation & automatic trigger feedback'}
          </p>
        </div>

        {step < 4 && (
          <div className="flex items-center gap-2">
            {[1, 2, 3].map((s) => (
              <div
                key={s}
                className={`w-8.5 h-8.5 rounded-full flex items-center justify-center text-xs font-bold tracking-wider transition-all duration-300 ${step === s
                    ? 'bg-primary text-white shadow-md shadow-primary/15 scale-110 font-extrabold'
                    : step > s
                      ? 'bg-emerald-500 text-white shadow-sm'
                      : 'bg-slate-100 text-slate-400 border border-slate-200/60'
                  }`}
              >
                {step > s ? '✓' : s}
              </div>
            ))}
          </div>
        )}
      </div>

      {errorMsg && (
        <div className="bg-rose-50 text-rose-800 border-l-4 border-rose-500 px-4 py-3 rounded-lg text-xs mb-6 flex justify-between items-center animate-fade-in font-semibold">
          <span>{errorMsg}</span>
          <button onClick={() => setErrorMsg('')} className="font-bold opacity-75 hover:opacity-100 px-1">&times;</button>
        </div>
      )}

      {/* STEP 1: Select Service */}
      {step === 1 && (
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.35, ease: 'easeOut' }}
          className="space-y-4"
        >
          <div className="grid gap-5 sm:grid-cols-2">
            {activeServices.map((srv) => (
              <button
                key={srv.id}
                id={`srv-btn-${srv.id}`}
                onClick={() => handleServiceSelect(srv.id)}
                className={`group text-left p-6 rounded-2xl border transition-all duration-300 flex flex-col justify-between hover:border-primary/45 hover:bg-slate-50/20 hover:shadow-[0_8px_30px_rgba(0,0,0,0.03)] cursor-pointer hover:scale-[1.025] active:scale-[0.98] ${selectedServiceId === srv.id
                    ? 'border-primary bg-secondary/10 ring-2 ring-primary/10 shadow-lg'
                    : 'border-slate-200 bg-white shadow-xs'
                  }`}
              >
                <div className="w-full">
                  <div className="flex justify-between items-start gap-4 w-full">
                    <h4 className="font-display font-bold text-slate-900 text-base group-hover:text-primary transition-colors tracking-tight">
                      {srv.name}
                    </h4>
                    <span className="font-display font-extrabold text-slate-900 text-base shrink-0">
                      {formatUSD(srv.price, settings.currency)}
                    </span>
                  </div>
                  <p className="text-xs text-slate-500 mt-2 line-clamp-2 leading-relaxed font-semibold">
                    {srv.description || 'No description listed.'}
                  </p>
                </div>

                <div className="flex items-center gap-2 mt-5 pt-3.5 border-t border-slate-100 text-slate-450 text-xs w-full">
                  <Clock className="w-3.5 h-3.5 text-primary/70 shrink-0" />
                  <span className="font-semibold text-slate-500">{srv.durationMinutes} Min Duration</span>
                  <div className="ml-auto flex items-center text-primary font-bold group-hover:translate-x-1 transition-transform">
                    <span>Select Package</span>
                    <ChevronRight className="w-3.5 h-3.5 ml-0.5" />
                  </div>
                </div>
              </button>
            ))}
            {activeServices.length === 0 && (
              <div className="col-span-2 text-center py-10 bg-slate-50 rounded-xl border border-dashed border-slate-200">
                <span className="text-slate-500 text-sm">No services are currently active. Update them in Admin settings.</span>
              </div>
            )}
          </div>
        </motion.div>
      )}      {/* STEP 2: Configure Date & Timeslots */}
      {step === 2 && (
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.35, ease: 'easeOut' }}
          className="space-y-6"
        >
          <button
            type="button"
            onClick={() => setStep(1)}
            className="text-xs font-bold text-slate-500 hover:text-slate-800 flex items-center gap-1.5 mb-2 hover:-translate-x-1 transition-all duration-350 cursor-pointer"
          >
            ← Change selected service ({selectedService?.name})
          </button>

          {/* Specialist Selection bento panel */}
          <div className="bg-slate-50/50 border border-slate-150 rounded-2xl p-4.5 shadow-[inset_0_1px_2px_rgba(0,0,0,0.01)]">
            <div className="flex items-center gap-2 mb-3.5">
              <Users className="w-4 h-4 text-primary" />
              <span className="font-display font-extrabold text-[11px] uppercase tracking-wider text-slate-650">Choose Specialist (Optional)</span>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
              <button
                type="button"
                onClick={() => { setSelectedStaffId(''); setSelectedSlot(''); }}
                className={`p-3 rounded-xl border text-left transition-all duration-300 hover:scale-[1.02] hover:border-primary/40 cursor-pointer relative ${selectedStaffId === ''
                    ? 'border-primary bg-secondary/20 ring-2 ring-primary/10 font-bold shadow-xs'
                    : 'border-slate-200 text-slate-800 bg-white shadow-xs'
                  }`}
              >
                <span className="block text-xs font-extrabold text-slate-800">Any Stylist</span>
                <span className="text-[9px] text-slate-450 font-normal mt-0.5 block">Fastest availability</span>
              </button>

              {staff.filter(s => s.active).map(s => (
                <button
                  key={s.id}
                  type="button"
                  onClick={() => { setSelectedStaffId(s.id); setSelectedSlot(''); }}
                  className={`p-3 rounded-xl border text-left transition-all duration-300 hover:scale-[1.02] hover:border-primary/40 cursor-pointer relative ${selectedStaffId === s.id
                      ? 'border-primary bg-secondary/20 ring-2 ring-primary/10 font-bold shadow-xs'
                      : 'border-slate-200 text-slate-800 bg-white shadow-xs'
                    }`}
                >
                  <span className="block text-xs font-extrabold text-slate-800 truncate">{s.name}</span>
                  <span className="text-[9px] text-slate-450 font-normal mt-0.5 block truncate">{s.role}</span>
                </button>
              ))}
            </div>
          </div>

          <div className="grid md:grid-cols-12 gap-6 items-start">
            {/* Custom Interactive Grid Calendar */}
            <div className="md:col-span-7 bg-white rounded-2xl p-5 border border-slate-200/70 shadow-xs">
              <div className="flex justify-between items-center mb-4.5">
                <h4 className="font-display font-extrabold text-sm text-slate-800 tracking-tight uppercase">{monthLabel}</h4>
                <div className="flex gap-1.5">
                  <button
                    type="button"
                    onClick={handlePrevMonth}
                    className="p-1 px-2 text-slate-600 hover:bg-slate-100 hover:text-primary rounded-lg text-xs font-bold transition-all"
                  >
                    <ChevronLeft className="w-4 h-4" />
                  </button>
                  <button
                    type="button"
                    onClick={handleNextMonth}
                    className="p-1 px-2 text-slate-600 hover:bg-slate-100 hover:text-primary rounded-lg text-xs font-bold transition-all"
                  >
                    <ChevronRight className="w-4 h-4" />
                  </button>
                </div>
              </div>

              {/* Day Headers */}
              <div className="grid grid-cols-7 text-center text-[10px] font-extrabold text-slate-400 tracking-widest mb-3 uppercase">
                <span>SUN</span>
                <span>MON</span>
                <span>TUE</span>
                <span>WED</span>
                <span>THU</span>
                <span>FRI</span>
                <span>SAT</span>
              </div>

              {/* Actual Calendar Month Grid */}
              <div className="grid grid-cols-7 gap-1.5 text-center">
                {daysInMonth.map((dateObj, idx) => {
                  const dStr = formatDateStr(dateObj);
                  const today = new Date();
                  today.setHours(0, 0, 0, 0);

                  const isCurrentMonth = dateObj.getMonth() === currentMonth.getMonth();
                  const isPast = dateObj < today;

                  // Rule eligibility
                  const dow = dateObj.getDay();
                  const rule = availability.find(r => r.dayOfWeek === dow);
                  const isClosed = !rule || !rule.isWorkingDay;

                  // Custom blockers
                  const blockReason = getBlockedReason(dStr, customBlocks);
                  const isBlocked = !!blockReason;

                  const isBookable = !isPast && !isClosed && !isBlocked && isCurrentMonth;
                  const isSelected = selectedDate === dStr;

                  let cellClasses = 'h-10 w-full flex flex-col items-center justify-center rounded-xl text-xs font-bold relative transition-all duration-350 cursor-pointer hover:scale-105 active:scale-95 ';

                  if (!isCurrentMonth) {
                    cellClasses += 'text-slate-300 pointer-events-none ';
                  } else if (isPast) {
                    cellClasses += 'text-slate-250 line-through pointer-events-none ';
                  } else if (isClosed) {
                    cellClasses += 'text-rose-500 bg-rose-50/40 pointer-events-none ';
                  } else if (isBlocked) {
                    cellClasses += 'text-slate-500 bg-slate-100/60 ';
                  } else if (isBookable) {
                    cellClasses += 'text-slate-800 hover:bg-primary hover:text-white hover:shadow-sm ';
                  }

                  if (isSelected) {
                    cellClasses = 'h-10 w-full flex flex-col items-center justify-center rounded-xl text-xs font-extrabold bg-primary text-white ring-2 ring-primary ring-offset-2 scale-102 cursor-pointer shadow-md shadow-primary/20 ';
                  }

                  return (
                    <button
                      key={idx}
                      id={`cal-day-${dStr}`}
                      type="button"
                      disabled={!isBookable}
                      onClick={() => handleDateClick(dateObj)}
                      title={blockReason || (isClosed ? 'Closed' : '')}
                      className={cellClasses}
                    >
                      <span>{dateObj.getDate()}</span>
                      {isBlocked && (
                        <span className="absolute bottom-1 w-1 h-1 bg-slate-400 rounded-full"></span>
                      )}
                    </button>
                  );
                })}
              </div>

              <div className="mt-5 pt-4 border-t border-slate-100 flex gap-4 text-[9px] text-slate-500 font-extrabold tracking-widest uppercase justify-center flex-wrap">
                <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 bg-white border border-slate-250 rounded"></span>Available</span>
                <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 bg-rose-50 border border-rose-100 rounded"></span>Closed</span>
                <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 bg-slate-100 rounded border border-slate-250"></span>Blocked</span>
                <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 bg-primary rounded"></span>Selected</span>
              </div>
            </div>

            {/* Time Slot Selection Component - STICKY STACKING */}
            <div className="md:col-span-5 flex flex-col sticky top-24 self-start bg-slate-50/70 border border-slate-200/60 rounded-2xl p-4.5 shadow-2xs">
              <h4 className="font-display font-extrabold text-xs text-slate-800 flex items-center gap-2 mb-3 tracking-wide uppercase">
                <Clock className="w-4 h-4 text-primary animate-pulse" />
                <span>Timeslots Available</span>
              </h4>

              {!selectedDate ? (
                <div className="flex-1 flex flex-col items-center justify-center p-8 border border-dashed border-slate-250 rounded-xl bg-white text-center">
                  <span className="text-[11px] text-slate-450 leading-relaxed font-semibold">Select an highlighted date from the calendar to reveal active timeslots.</span>
                </div>
              ) : (
                <div className="flex-1 flex flex-col">
                  <p className="text-xs font-semibold text-slate-500 mb-3 bg-white p-2.5 rounded-lg border border-slate-200/60 text-center shadow-2xs">
                    Date: <strong className="text-slate-800 font-bold">{formatHumanDate(selectedDate)}</strong>
                  </p>

                  {availableSlots.length === 0 ? (
                    <div className="flex-1 flex flex-col items-center justify-center p-6 border border-rose-100 rounded-xl bg-white text-center">
                      <span className="text-xs text-rose-600 font-bold">No available timeslots.</span>
                      <p className="text-[10px] text-slate-400 mt-1 font-semibold">Try another day or contact studio administration.</p>
                    </div>
                  ) : (
                    <div className="grid grid-cols-2 gap-2 max-h-[220px] overflow-y-auto pr-1">
                      {availableSlots.map((slot) => {
                        const isMatch = selectedSlot === slot;
                        return (
                          <button
                            key={slot}
                            id={`time-btn-${slot}`}
                            type="button"
                            onClick={() => setSelectedSlot(slot)}
                            className={`p-2.5 text-center text-xs font-bold rounded-xl border transition-all duration-300 hover:scale-[1.03] active:scale-[0.97] cursor-pointer ${isMatch
                                ? 'bg-primary border-primary text-white shadow-md shadow-primary/10'
                                : 'border-slate-200 hover:border-primary/40 text-slate-700 bg-white shadow-2xs hover:bg-slate-50/50'
                              }`}
                          >
                            {slot}
                          </button>
                        );
                      })}
                    </div>
                  )}

                  {selectedSlot && (
                    <div className="mt-4 pt-3.5 border-t border-slate-200/50 flex justify-end">
                      <button
                        onClick={() => setStep(3)}
                        className="bg-primary hover:bg-primary/95 text-white rounded-xl px-5 py-2.5 text-xs font-bold tracking-wide transition-all duration-350 hover:scale-[1.03] active:scale-[0.97] flex items-center gap-1.5 shadow-md shadow-primary/10 cursor-pointer"
                      >
                        <span>Continue</span>
                        <ChevronRight className="w-4 h-4" />
                      </button>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        </motion.div>
      )}

      {/* STEP 3: Complete Guest Profiles */}
      {step === 3 && (
        <form onSubmit={handleBookingSubmit} className="space-y-4">
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.35, ease: 'easeOut' }}
            className="space-y-4"
          >
            <button
              type="button"
              onClick={() => setStep(2)}
              className="text-xs font-bold text-slate-500 hover:text-slate-800 flex items-center gap-1.5 mb-3 hover:-translate-x-1 transition-all duration-350 cursor-pointer"
            >
              ← Back to Calendar Settings
            </button>

            <div className="grid md:grid-cols-12 gap-6 items-start">
              {/* Left Column: Guest Registration Fields */}
              <div className="md:col-span-12 lg:col-span-7 space-y-4 bg-white border border-slate-200/80 rounded-2xl p-5 shadow-xs">
                <h4 className="font-display font-extrabold text-[11px] text-slate-600 uppercase tracking-widest border-b border-slate-100 pb-2.5">
                  Guest Credentials
                </h4>

                <div className="space-y-4">
                  <div>
                    <label className="block text-xs font-extrabold text-slate-700 mb-1.5 uppercase tracking-wider">Customer Name *</label>
                    <div className="relative">
                      <User className="absolute left-3.5 top-3.5 w-4 h-4 text-slate-400" />
                      <input
                        id="inp-customer-name"
                        type="text"
                        required
                        placeholder="e.g., Charles Xavier"
                        value={customerName}
                        onChange={(e) => setCustomerName(e.target.value)}
                        className="w-full text-sm pl-10 pr-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:border-primary focus:bg-white focus:ring-4 focus:ring-primary/5 transition-all text-slate-800 font-semibold"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-extrabold text-slate-700 mb-1.5 uppercase tracking-wider">Customer Email Address *</label>
                    <div className="relative">
                      <Mail className="absolute left-3.5 top-3.5 w-4 h-4 text-slate-400" />
                      <input
                        id="inp-customer-email"
                        type="email"
                        required
                        placeholder="e.g., charles@xavier-school.org"
                        value={customerEmail}
                        onChange={(e) => setCustomerEmail(e.target.value)}
                        className="w-full text-sm pl-10 pr-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:border-primary focus:bg-white focus:ring-4 focus:ring-primary/5 transition-all text-slate-800 font-semibold"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-extrabold text-slate-700 mb-1.5 uppercase tracking-wider">Phone Number</label>
                    <div className="relative">
                      <Phone className="absolute left-3.5 top-3.5 w-4 h-4 text-slate-400" />
                      <input
                        id="inp-customer-phone"
                        type="tel"
                        placeholder="e.g., 555-0155"
                        value={customerPhone}
                        onChange={(e) => setCustomerPhone(e.target.value)}
                        className="w-full text-sm pl-10 pr-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:border-primary focus:bg-white focus:ring-4 focus:ring-primary/5 transition-all text-slate-800 font-semibold"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-extrabold text-slate-700 mb-1.5 uppercase tracking-wider">Special Notes / Requests</label>
                    <div className="relative">
                      <FileText className="absolute left-3.5 top-3.5 w-4 h-4 text-slate-400" />
                      <input
                        id="inp-customer-notes"
                        type="text"
                        placeholder="e.g., Prefers organic hair care products"
                        value={customerNotes}
                        onChange={(e) => setCustomerNotes(e.target.value)}
                        className="w-full text-sm pl-10 pr-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:border-primary focus:bg-white focus:ring-4 focus:ring-primary/5 transition-all text-slate-800 font-semibold"
                      />
                    </div>
                  </div>
                </div>
              </div>

              {/* Right Column: Clean, Minimalist Reservation Summary */}
              <div className="md:col-span-12 lg:col-span-5 sticky top-24 self-start space-y-4">
                <div className="bg-white rounded-2xl p-6 shadow-xs border border-slate-200/80 relative overflow-hidden">
                  <div className="space-y-4.5">
                    <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                      <span className="text-[10px] text-[#291100] bg-[#ECF5E2] font-extrabold px-2.5 py-0.5 rounded uppercase tracking-wider font-mono">
                        Summary
                      </span>
                      <span className="text-xs text-slate-500 font-medium">Final Confirmation</span>
                    </div>

                    <div>
                      <h4 className="font-bold text-slate-400 text-[9px] uppercase tracking-wider">Service Selected</h4>
                      <div className="text-base font-bold text-slate-900 mt-1 leading-snug">{selectedService?.name}</div>
                    </div>

                    <div className="grid grid-cols-2 gap-3 py-1 text-xs">
                      <div>
                        <span className="text-slate-400 block font-bold text-[9px] uppercase tracking-wider">Specialist Assigned</span>
                        <strong className="text-slate-800 block text-[11px] mt-0.5 truncate">
                          {staff.find(s => s.id === selectedStaffId)?.name || 'Any Available Specialist'}
                        </strong>
                      </div>
                      <div>
                        <span className="text-slate-400 block font-bold text-[9px] uppercase tracking-wider">Duration</span>
                        <strong className="text-slate-800 block text-[11px] mt-0.5">{selectedService?.durationMinutes} Minutes</strong>
                      </div>
                    </div>

                    <div className="border-t border-slate-100 pt-3.5 space-y-2 text-xs">
                      <div className="flex justify-between items-center">
                        <span className="text-slate-400 font-bold text-[9px] uppercase tracking-wider">Date</span>
                        <span className="text-slate-800 font-bold">{formatHumanDate(selectedDate)}</span>
                      </div>
                      <div className="flex justify-between items-center">
                        <span className="text-slate-400 font-bold text-[9px] uppercase tracking-wider">Timing Slot</span>
                        <span className="text-slate-800 font-bold font-mono text-[11px] bg-slate-50 border border-slate-200 px-2 py-0.5 rounded">{selectedSlot}</span>
                      </div>
                    </div>

                    <div className="border-t border-slate-100 pt-4 mt-2 flex flex-col sm:flex-row justify-between items-stretch sm:items-center gap-3">
                      <div>
                        <span className="text-slate-400 font-bold text-[9px] uppercase tracking-wider block">Estimated Total</span>
                        <div className="text-slate-900 font-extrabold text-lg leading-none mt-1 font-display">
                          {selectedService ? formatUSD(selectedService.price, settings.currency) : ''}
                        </div>
                      </div>
                      <button
                        id="submit-booking-btn"
                        type="submit"
                        disabled={loading}
                        className="bg-secondary hover:opacity-90 text-white rounded-xl px-5 py-3 text-xs font-extrabold tracking-wide transition-all flex items-center justify-center gap-1.5 cursor-pointer"
                      >
                        {loading ? (
                          <span className="animate-pulse">Confirming...</span>
                        ) : (
                          <>
                            <CheckCircle2 className="w-4 h-4 text-white" />
                            <span>Confirm Booking</span>
                          </>
                        )}
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </motion.div>
        </form>
      )}

      {/* STEP 4: Success Preview Receipt */}
      {step === 4 && bookingSuccess && (
        <div className="text-center py-6 space-y-6">
          <div className="w-16 h-16 bg-emerald-50 text-emerald-600 rounded-full flex items-center justify-center mx-auto ring-8 ring-emerald-50/50 border border-emerald-100">
            <CheckCircle2 className="w-8 h-8" />
          </div>

          <div>
            <h4 className="font-display text-xl font-bold text-slate-900 tracking-tight">Appointment Scheduled!</h4>
            <p className="text-xs text-slate-500 mt-1">A professional confirmation email has been simulated and cataloged</p>
          </div>

          <div className="bg-slate-50/80 rounded-2xl p-5 border border-slate-200 max-w-md mx-auto text-left text-xs space-y-3 shadow-[0_1px_2px_rgba(0,0,0,0.02)]">
            <div className="flex justify-between items-center pb-2 border-b border-slate-200">
              <span className="text-slate-400">Reservation Identifier</span>
              <span className="font-mono font-bold text-slate-800 bg-white border border-slate-200 px-2 py-0.5 rounded">{bookingSuccess.id}</span>
            </div>

            <div className="flex justify-between items-center">
              <span className="text-slate-400">Customer Name</span>
              <span className="font-semibold text-slate-800">{bookingSuccess.customerName}</span>
            </div>

            <div className="flex justify-between items-center">
              <span className="text-slate-400">Assigned Service</span>
              <span className="font-semibold text-slate-800">{selectedService?.name}</span>
            </div>

            <div className="flex justify-between items-center">
              <span className="text-slate-400">Schedule Date</span>
              <span className="font-semibold text-slate-800">{formatHumanDate(bookingSuccess.date)}</span>
            </div>

            <div className="flex justify-between items-center">
              <span className="text-slate-400">Time Interval</span>
              <span className="font-semibold text-slate-800">{bookingSuccess.timeSlot}</span>
            </div>

            {bookingSuccess.staffId && (
              <div className="flex justify-between items-center">
                <span className="text-slate-400">Assigned Specialist</span>
                <span className="font-semibold text-slate-800">
                  {staff.find(s => s.id === bookingSuccess.staffId)?.name || 'Professional'}
                </span>
              </div>
            )}

            <div className="flex justify-between items-center pt-2.5 border-t border-slate-200 font-bold text-sm">
              <span className="text-slate-700">Total Price Due</span>
              <span className="text-emerald-600">{selectedService ? formatUSD(selectedService.price, settings.currency) : ''}</span>
            </div>
          </div>

          <div className="flex justify-center gap-3">
            <button
              onClick={resetWizardAll}
              className="bg-primary hover:bg-primary/95 text-white rounded-lg px-5 py-2.5 text-xs font-bold transition flex items-center gap-1.5 shadow-md shadow-primary/10"
            >
              <Plus className="w-4 h-4" />
              <span>Book Another</span>
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
