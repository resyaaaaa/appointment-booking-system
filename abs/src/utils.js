// Convert hourly time text e.g. "09:00" or "13:30" to minutes from midnight
export function timeToMinutes(time) {
  const [h, m] = time.split(':').map(Number);
  return h * 60 + m;
}

// Convert minutes from midnight back to 12-hour AM/PM text
export function minutesToTime12(minutes) {
  let hours = Math.floor(minutes / 60);
  const mins = minutes % 60;
  const ampm = hours >= 12 ? 'PM' : 'AM';
  hours = hours % 12;
  hours = hours ? hours : 12; // the hour '0' should be '12'
  const minStr = mins.toString().padStart(2, '0');
  const hourStr = hours.toString().padStart(2, '0');
  return `${hourStr}:${minStr} ${ampm}`;
}

// Safe helper to format Date object into local YYYY-MM-DD format
export function formatDateStr(date) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

// Convert YYYY-MM-DD string to a highly readable local format, e.g., "Thu, Jun 11, 2026"
export function formatHumanDate(dateStr) {
  if (!dateStr) return '';
  const parts = dateStr.split('-');
  if (parts.length !== 3) return dateStr;
  const year = parseInt(parts[0], 10);
  const month = parseInt(parts[1], 10) - 1;
  const day = parseInt(parts[2], 10);
  const dateObj = new Date(year, month, day);
  if (isNaN(dateObj.getTime())) return dateStr;

  return dateObj.toLocaleDateString('en-US', {
    weekday: 'short',
    year: 'numeric',
    month: 'short',
    day: 'numeric'
  });
}

// Convert creation date ISO string to a beautiful date and time, e.g., "Jun 11, 2026 at 07:15 PM"
export function formatHumanDateTime(isoStr) {
  if (!isoStr) return '';
  const dateObj = new Date(isoStr);
  if (isNaN(dateObj.getTime())) return isoStr;
  
  const dateFormatted = dateObj.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric'
  });
  
  const timeFormatted = dateObj.toLocaleTimeString('en-US', {
    hour: '2-digit',
    minute: '2-digit'
  });
  
  return `${dateFormatted} at ${timeFormatted}`;
}

// Check if a specific YYYY-MM-DD date is locked or blocked out
export function getBlockedReason(dateStr, customBlocks) {
  const matchingBlock = customBlocks.find(b => b.date === dateStr);
  if (matchingBlock) {
    const isFullBlock = !matchingBlock.startTime || 
                        matchingBlock.startTime === '' || 
                        matchingBlock.startTime === '00:00' ||
                        (matchingBlock.startTime === '00:00' && matchingBlock.endTime === '23:59') ||
                        (matchingBlock.startTime === '00:00' && matchingBlock.endTime === '24:00') ||
                        matchingBlock.endTime === '23:59' ||
                        matchingBlock.endTime === '24:00';
    if (isFullBlock) {
      return matchingBlock.reason || 'Closed';
    }
  }
  return null;
}

// Convert 12-hour AM/PM string (e.g. "09:00 AM" or "11:30 PM") to minutes from midnight
export function time12ToMinutes(timeStr) {
  if (!timeStr) return null;
  const match = timeStr.trim().match(/^(\d+):(\d+)\s*(AM|PM|am|pm)?$/i);
  if (!match) {
    const parts = timeStr.split(':');
    if (parts.length === 2) {
      const h = parseInt(parts[0], 10);
      const m = parseInt(parts[1], 10);
      if (!isNaN(h) && !isNaN(m)) return h * 60 + m;
    }
    return null;
  }
  let h = parseInt(match[1], 10);
  const m = parseInt(match[2], 10);
  const ampm = match[3] ? match[3].toUpperCase() : null;
  if (ampm) {
    if (ampm === 'PM' && h < 12) h += 12;
    if (ampm === 'AM' && h === 12) h = 0;
  }
  return h * 60 + m;
}

// Generate working timeslots for a given date
export function generateAvailableSlots(
  dateStr,
  appointments,
  availabilityRules,
  customBlocks,
  durationMinutes,
  selectedStaffId = '',
  staff = [],
  services = []
) {
  // Safe parsing of YYYY-MM-DD string to local Date object
  const [year, month, day] = dateStr.split('-').map(Number);
  const dateObj = new Date(year, month - 1, day);
  const dayOfWeek = dateObj.getDay(); // 0 = Sunday, 1 = Monday...

  // Find business day config
  const rule = availabilityRules.find(r => r.dayOfWeek === dayOfWeek);
  if (!rule || !rule.isWorkingDay) {
    return [];
  }

  // Check if entire day is blocked by custom rule
  const wholeDayBlock = customBlocks.find(b => 
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
  if (wholeDayBlock) {
    return [];
  }

  const startMin = timeToMinutes(rule.startTime);
  const endMin = timeToMinutes(rule.endTime);
  const breakStart = rule.breakTimeStart ? timeToMinutes(rule.breakTimeStart) : null;
  const breakEnd = rule.breakTimeEnd ? timeToMinutes(rule.breakTimeEnd) : null;

  const slots = [];
  
  // Use a standard 30-minute block increment for appointments
  const interval = 30;

  // Active bookable staff members
  const activeStaff = staff.filter(s => s.active);

  for (let current = startMin; current + durationMinutes <= endMin; current += interval) {
    // Check if slot falls during break
    if (breakStart !== null && breakEnd !== null) {
      const slotOverlapBreak = (current < breakEnd && current + durationMinutes > breakStart);
      if (slotOverlapBreak) {
        continue;
      }
    }

    // Check if slot falls during custom partial block (e.g. staff training)
    const activeBlocks = customBlocks.filter(b => b.date === dateStr && b.startTime && b.endTime);
    let isBlocked = false;
    for (const b of activeBlocks) {
      const bStart = timeToMinutes(b.startTime);
      const bEnd = timeToMinutes(b.endTime);
      if (current < bEnd && current + durationMinutes > bStart) {
        isBlocked = true;
        break;
      }
    }
    if (isBlocked) {
      continue;
    }

    const slotTimeLabel = minutesToTime12(current);

    // Filter out occupied slots using duration overlap logic [Start, Start + Duration)
    let isOccupied = false;

    const staffHasOverlap = (staffIdToCheck) => {
      return appointments.some(appt => {
        if (appt.date !== dateStr) return false;
        if (appt.status !== 'confirmed' && appt.status !== 'pending') return false;
        if (appt.staffId !== staffIdToCheck) return false;

        const apptStartVal = time12ToMinutes(appt.timeSlot);
        if (apptStartVal === null) return false;

        // Find appointment service duration
        const apptService = (services || []).find(s => s.id === appt.serviceId);
        const apptDuration = apptService ? apptService.durationMinutes : 30;

        const apptEndVal = apptStartVal + apptDuration;
        const currentEndVal = current + durationMinutes;

        // Check if intervals overlap
        return apptStartVal < currentEndVal && current < apptEndVal;
      });
    };

    if (selectedStaffId) {
      // If a specific professional is selected, check if THEY have any active overlapping booking
      isOccupied = staffHasOverlap(selectedStaffId);
    } else {
      // If "Any Available" is chosen, slot is only occupied if ALL active staff members are booked
      const availableStaff = activeStaff.filter(s => !staffHasOverlap(s.id));

      // Also account for unassigned bookings that might overlap general capacity
      const unassignedOverlapCount = appointments.filter(appt => {
        if (appt.date !== dateStr) return false;
        if (appt.status !== 'confirmed' && appt.status !== 'pending') return false;
        if (appt.staffId) return false; // has assigned staff

        const apptStartVal = time12ToMinutes(appt.timeSlot);
        if (apptStartVal === null) return false;

        const apptService = (services || []).find(s => s.id === appt.serviceId);
        const apptDuration = apptService ? apptService.durationMinutes : 30;

        const apptEndVal = apptStartVal + apptDuration;
        const currentEndVal = current + durationMinutes;

        return apptStartVal < currentEndVal && current < apptEndVal;
      }).length;

      const freeCount = activeStaff.length === 0 ? (1 - unassignedOverlapCount) : (availableStaff.length - unassignedOverlapCount);
      isOccupied = freeCount <= 0;
    }

    if (!isOccupied) {
      slots.push(slotTimeLabel);
    }
  }

  return slots;
}

// Format Currency (supports ISO 3-letter codes and arbitrary symbols)
export function formatUSD(value, currency = 'RM') {
  const norm = (currency || 'RM').trim();
  if (norm.length === 3) {
    try {
      return new Intl.NumberFormat('en-US', {
        style: 'currency',
        currency: norm
      }).format(value);
    } catch(e) {}
  }
  
  // Format cleanly with any currency code / symbol input e.g. "£", "$", "RM", "EUR"
  try {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: norm.length === 3 ? norm : 'USD'
    }).format(value).replace('$', norm);
  } catch (e) {
    return `${norm}${Number(value).toFixed(2)}`;
  }
}

// Clean Day names mapping
export const DAYS_OF_WEEK = [
  'Sunday',
  'Monday',
  'Tuesday',
  'Wednesday',
  'Thursday',
  'Friday',
  'Saturday'
];
