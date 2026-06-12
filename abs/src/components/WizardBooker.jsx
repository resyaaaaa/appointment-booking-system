import React, { useState, useMemo } from 'react';
import { Calendar, Clock, User, Phone, Mail, FileText, CheckCircle2, ChevronRight, ChevronLeft, Plus, Users, Award } from 'lucide-react';
import { generateAvailableSlots, formatUSD, DAYS_OF_WEEK, getBlockedReason, formatDateStr } from '../utils';

export default function WizardBooker({
  services,
  appointments,
  availability,
  customBlocks,
  onBookingComplete,
  staffMode = false,
  staff = [],
  settings = {}
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
    today.setHours(0,0,0,0);
    
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
      const response = await fetch('/api/appointments', {
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
    <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6 max-w-3xl mx-auto">
      {/* Wizard Step Progression Timeline */}
      <div className="flex items-center justify-between border-b border-slate-100 pb-5 mb-6">
        <div>
          <h3 className="font-display font-bold text-slate-950 text-base flex items-center gap-2">
            {staffMode ? (
              <span className="bg-amber-50 text-amber-800 text-[10px] uppercase font-bold tracking-wider px-2.5 py-1 rounded border border-amber-200">
                Core Admin Override
              </span>
            ) : (
              <span className="bg-secondary/30 text-primary text-[10px] uppercase font-bold tracking-wider px-2.5 py-1 rounded border border-secondary">
                Secure Client Portal
              </span>
            )}
            <span>Schedule Appointment</span>
          </h3>
          <p className="text-xs text-slate-550 mt-1">
            {step === 1 && 'Step 1: Pick from our catalog of hair & skin treatments'}
            {step === 2 && 'Step 2: select available session day & hourly slot'}
            {step === 3 && 'Step 3: Provide client details for automatic confirmations'}
            {step === 4 && 'Complete: Success confirmation & automatic trigger feedback'}
          </p>
        </div>
        
        {step < 4 && (
          <div className="flex items-center gap-2">
            {[1, 2, 3].map((s) => (
              <div
                key={s}
                className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold tracking-wider transition-all duration-300 ${
                  step === s
                    ? 'bg-primary text-white shadow-md shadow-primary/10 scale-105'
                    : step > s
                    ? 'bg-emerald-500 text-white shadow-sm shadow-emerald-500/5'
                    : 'bg-slate-100 text-slate-400 border border-slate-200'
                }`}
              >
                {step > s ? '✓' : s}
              </div>
            ))}
          </div>
        )}
      </div>

      {errorMsg && (
        <div className="bg-rose-50 text-rose-800 border-l-4 border-rose-500 px-4 py-3 rounded-lg text-xs mb-6 flex justify-between items-center animate-fade-in">
          <span>{errorMsg}</span>
          <button onClick={() => setErrorMsg('')} className="font-bold opacity-75 hover:opacity-100 px-1">&times;</button>
        </div>
      )}

      {/* STEP 1: Select Service */}
      {step === 1 && (
        <div className="space-y-4">
          <div className="grid gap-3.5 sm:grid-cols-2">
            {activeServices.map((srv) => (
              <button
                key={srv.id}
                id={`srv-btn-${srv.id}`}
                onClick={() => handleServiceSelect(srv.id)}
                className={`group text-left p-5 rounded-xl border transition-all duration-200 flex flex-col justify-between hover:border-primary/50 hover:bg-slate-50/20 hover:shadow-sm ${
                  selectedServiceId === srv.id
                    ? 'border-primary bg-secondary/15 ring-2 ring-primary/20'
                    : 'border-slate-150 bg-white'
                }`}
              >
                <div className="w-full">
                  <div className="flex justify-between items-start gap-2 w-full">
                    <h4 className="font-display font-bold text-slate-900 text-base group-hover:text-primary transition-colors">
                      {srv.name}
                    </h4>
                    <span className="font-bold text-slate-900 text-base shrink-0">
                      {formatUSD(srv.price, settings.currency)}
                    </span>
                  </div>
                  <p className="text-xs text-slate-500 mt-2 line-clamp-2 leading-relaxed">
                    {srv.description || 'No description listed.'}
                  </p>
                </div>

                <div className="flex items-center gap-2 mt-4 pt-3.5 border-t border-slate-150/70 text-slate-550 text-xs w-full">
                  <Clock className="w-3.5 h-3.5 text-slate-400" />
                  <span>{srv.durationMinutes} Min Duration</span>
                  <div className="ml-auto flex items-center text-primary font-bold group-hover:translate-x-0.5 transition-transform">
                    <span>Select Service</span>
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
        </div>
      )}

      {/* STEP 2: Configure Date & Timeslots */}
      {step === 2 && (
        <div className="space-y-6">
          <button 
            onClick={() => setStep(1)}
            className="text-xs font-medium text-slate-500 hover:text-slate-800 flex items-center gap-1 mb-2"
          >
            ← Change selected service ({selectedService?.name})
          </button>

          {/* Specialist Selection bento panel */}
          <div className="bg-slate-50 border border-slate-150 rounded-2xl p-4">
            <div className="flex items-center gap-2 mb-3">
              <Users className="w-4 h-4 text-primary" />
              <span className="font-display font-bold text-xs uppercase tracking-wide text-slate-700">Choose Specialist (Optional)</span>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
              <button
                type="button"
                onClick={() => { setSelectedStaffId(''); setSelectedSlot(''); }}
                className={`p-2.5 rounded-xl border text-left transition duration-150 relative ${
                  selectedStaffId === ''
                    ? 'border-primary bg-secondary/50 ring-2 ring-primary/20 font-bold'
                    : 'border-slate-200 text-slate-800 hover:border-slate-350 bg-white shadow-sm'
                }`}
              >
                <span className="block text-xs font-bold text-slate-800">Any Stylist</span>
                <span className="text-[9px] text-slate-400 font-normal">Fastest availability</span>
              </button>

              {staff.filter(s => s.active).map(s => (
                <button
                  key={s.id}
                  type="button"
                  onClick={() => { setSelectedStaffId(s.id); setSelectedSlot(''); }}
                  className={`p-2.5 rounded-xl border text-left transition duration-150 ${
                    selectedStaffId === s.id
                      ? 'border-primary bg-secondary/55 ring-2 ring-primary/20 font-bold'
                      : 'border-slate-200 text-slate-800 hover:border-slate-350 bg-white shadow-sm'
                  }`}
                >
                  <span className="block text-xs font-bold text-slate-800 truncate">{s.name}</span>
                  <span className="text-[9px] text-slate-400 font-normal truncate">{s.role}</span>
                </button>
              ))}
            </div>
          </div>

          <div className="grid md:grid-cols-12 gap-6">
            {/* Custom Interactive Grid Calendar */}
            <div className="md:col-span-7 bg-slate-50/70 rounded-2xl p-4 border border-slate-100">
              <div className="flex justify-between items-center mb-4">
                <h4 className="font-semibold text-sm text-slate-700">{monthLabel}</h4>
                <div className="flex gap-1">
                  <button 
                    onClick={handlePrevMonth}
                    className="p-1 px-2 text-slate-600 hover:bg-slate-200 rounded text-xs font-semibold"
                  >
                    <ChevronLeft className="w-4 h-4" />
                  </button>
                  <button 
                    onClick={handleNextMonth}
                    className="p-1 px-2 text-slate-600 hover:bg-slate-200 rounded text-xs font-semibold"
                  >
                    <ChevronRight className="w-4 h-4" />
                  </button>
                </div>
              </div>

              {/* Day Headers */}
              <div className="grid grid-cols-7 text-center text-[10px] font-bold text-slate-400 tracking-wider mb-2">
                <span>SUN</span>
                <span>MON</span>
                <span>TUE</span>
                <span>WED</span>
                <span>THU</span>
                <span>FRI</span>
                <span>SAT</span>
              </div>

              {/* Actual Calendar Month Grid */}
              <div className="grid grid-cols-7 gap-1 text-center">
                {daysInMonth.map((dateObj, idx) => {
                  const dStr = formatDateStr(dateObj);
                  const today = new Date();
                  today.setHours(0,0,0,0);
                  
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

                  let cellClasses = 'h-9 w-full flex flex-col items-center justify-center rounded-lg text-xs font-semibold relative transition-all duration-150 ';
                  
                  if (!isCurrentMonth) {
                    cellClasses += 'text-slate-350 cursor-not-allowed ';
                  } else if (isPast) {
                    cellClasses += 'text-slate-300 line-through cursor-not-allowed ';
                  } else if (isClosed) {
                    cellClasses += 'text-rose-500 bg-rose-50/40 cursor-not-allowed ';
                  } else if (isBlocked) {
                    cellClasses += 'text-amber-600 bg-amber-50/40 cursor-not-allowed ';
                  } else if (isBookable) {
                    cellClasses += 'text-slate-800 hover:bg-primary hover:text-white cursor-pointer ';
                  }

                  if (isSelected) {
                    cellClasses = 'h-9 w-full flex flex-col items-center justify-center rounded-lg text-xs font-bold bg-primary text-white ring-2 ring-primary ring-offset-2 scale-102 cursor-pointer shadow-sm shadow-primary/20 ';
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
                        <span className="absolute bottom-1 w-1 h-1 bg-amber-400 rounded-full"></span>
                      )}
                    </button>
                  );
                })}
              </div>

              <div className="mt-4 pt-3.5 border-t border-slate-205 flex gap-4 text-[10px] text-slate-500 font-bold tracking-wide uppercase justify-center flex-wrap">
                <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 bg-white border border-slate-250 rounded"></span>Available</span>
                <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 bg-rose-50 border border-rose-100 rounded"></span>Closed</span>
                <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 bg-amber-50 rounded border border-amber-250"></span>Blocked</span>
                <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 bg-primary rounded"></span>Selected</span>
              </div>
            </div>

            {/* Time Slot Selection Component */}
            <div className="md:col-span-5 flex flex-col">
              <h4 className="font-display font-bold text-sm text-slate-900 flex items-center gap-2 mb-3">
                <Clock className="w-4 h-4 text-primary animate-pulse" />
                <span>Timeslots Available</span>
              </h4>

              {!selectedDate ? (
                <div className="flex-1 flex flex-col items-center justify-center p-6 border border-dashed border-slate-200 rounded-2xl bg-slate-50/50">
                  <span className="text-xs text-slate-400 text-center leading-relaxed">Please select an highlighted date on the calendar to see available slots</span>
                </div>
              ) : (
                <div className="flex-1 flex flex-col bg-white">
                  <p className="text-xs font-semibold text-slate-500 mb-3 bg-slate-50 p-2.5 rounded-lg border border-slate-150 text-center">
                    Selected: <strong className="text-slate-800">{new Date(selectedDate).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' })}</strong>
                  </p>
                  
                  {availableSlots.length === 0 ? (
                    <div className="flex-1 flex flex-col items-center justify-center p-6 border border-rose-100 rounded-2xl bg-rose-50/20 text-center">
                      <span className="text-xs text-rose-600 font-medium">Unfortunately, no timeslots are free on this date.</span>
                      <p className="text-[10px] text-slate-500 mt-1">Try another day or contact business admin.</p>
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
                            className={`p-2.5 text-center text-xs font-bold rounded-lg border transition duration-150 ${
                              isMatch
                                ? 'bg-primary border-primary text-white shadow-md shadow-primary/10'
                                : 'border-slate-200 hover:border-primary/50 text-slate-700 bg-white hover:bg-secondary/20'
                            }`}
                          >
                            {slot}
                          </button>
                        );
                      })}
                    </div>
                  )}

                  {selectedSlot && (
                    <div className="mt-auto pt-4 border-t border-slate-150 flex justify-end">
                      <button
                        onClick={() => setStep(3)}
                        className="bg-primary hover:bg-primary/95 text-white rounded-lg px-5 py-2.5 text-xs font-bold transition flex items-center gap-1.5 shadow-md shadow-primary/10"
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
        </div>
      )}

      {/* STEP 3: Complete Guest Profiles */}
      {step === 3 && (
        <form onSubmit={handleBookingSubmit} className="space-y-4">
          <button 
            type="button"
            onClick={() => setStep(2)}
            className="text-xs font-medium text-slate-500 hover:text-slate-800 flex items-center gap-1 mb-2"
          >
            ← Back to Calendar Settings
          </button>

          <div className="bg-slate-50 text-xs rounded-xl p-4 border border-slate-100 flex flex-wrap gap-x-6 gap-y-2 mb-4">
            <div>
              <span className="text-slate-500 mr-1.5">Service:</span>
              <strong className="text-slate-800">{selectedService?.name}</strong>
            </div>
            <div>
              <span className="text-slate-500 mr-1.5">Date:</span>
              <strong className="text-slate-800">{selectedDate}</strong>
            </div>
            <div>
              <span className="text-slate-500 mr-1.5">Timing:</span>
              <strong className="text-slate-800">{selectedSlot}</strong>
            </div>
            <div>
              <span className="text-slate-500 mr-1.5">Total:</span>
              <strong className="text-emerald-700">{selectedService ? formatUSD(selectedService.price, settings.currency) : ''}</strong>
            </div>
            {selectedStaffId && (
              <div>
                <span className="text-slate-500 mr-1.5">Expert:</span>
                <strong className="text-slate-800">
                  {staff.find(s => s.id === selectedStaffId)?.name || 'Professional'}
                </strong>
              </div>
            )}
          </div>

          <div className="grid md:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1.5">Customer Name *</label>
              <div className="relative">
                <User className="absolute left-3 top-3 w-4 h-4 text-slate-400" />
                <input
                  id="inp-customer-name"
                  type="text"
                  required
                  placeholder="e.g., Charles Xavier"
                  value={customerName}
                  onChange={(e) => setCustomerName(e.target.value)}
                  className="w-full text-sm pl-9 pr-3 py-2.5 bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:border-primary focus:bg-white focus:ring-2 focus:ring-secondary/50 transition-all"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1.5">Customer Email Address *</label>
              <div className="relative">
                <Mail className="absolute left-3 top-3 w-4 h-4 text-slate-400" />
                <input
                  id="inp-customer-email"
                  type="email"
                  required
                  placeholder="e.g., charles@xavier-school.org"
                  value={customerEmail}
                  onChange={(e) => setCustomerEmail(e.target.value)}
                  className="w-full text-sm pl-9 pr-3 py-2.5 bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:border-primary focus:bg-white focus:ring-2 focus:ring-secondary/50 transition-all"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1.5">Phone Number</label>
              <div className="relative">
                <Phone className="absolute left-3 top-3 w-4 h-4 text-slate-400" />
                <input
                  id="inp-customer-phone"
                  type="tel"
                  placeholder="e.g., 555-0155"
                  value={customerPhone}
                  onChange={(e) => setCustomerPhone(e.target.value)}
                  className="w-full text-sm pl-9 pr-3 py-2.5 bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:border-primary focus:bg-white focus:ring-2 focus:ring-secondary/50 transition-all"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1.5">Special Notes / Requests</label>
              <div className="relative">
                <FileText className="absolute left-3 top-3 w-4 h-4 text-slate-400" />
                <input
                  id="inp-customer-notes"
                  type="text"
                  placeholder="e.g., Prefers specific products"
                  value={customerNotes}
                  onChange={(e) => setCustomerNotes(e.target.value)}
                  className="w-full text-sm pl-9 pr-3 py-2.5 bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:border-primary focus:bg-white focus:ring-2 focus:ring-secondary/50 transition-all"
                />
              </div>
            </div>
          </div>

          <div className="pt-4 flex border-t border-slate-100 justify-end">
            <button
              id="submit-booking-btn"
              type="submit"
              disabled={loading}
              className="bg-primary hover:bg-primary/95 text-white rounded-lg px-6 py-2.5 text-xs font-bold transition flex items-center justify-center gap-2 shadow-md shadow-primary/10"
            >
              {loading ? (
                <span>Confirming Appointment slot...</span>
              ) : (
                <>
                  <CheckCircle2 className="w-4 h-4 text-emerald-300" />
                  <span>Confirm Reservation</span>
                </>
              )}
            </button>
          </div>
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
              <span className="font-semibold text-slate-800">{bookingSuccess.date}</span>
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
