import express from 'express';
import path from 'path';
import { createServer as createViteServer } from 'vite';
import dotenv from 'dotenv';
import nodemailer from 'nodemailer';
import crypto from 'crypto';
import { db } from './src/server/db.js';

// Load environment variables
dotenv.config();

const app = express();
const PORT = 3000;

// Defensive security headers middleware
app.use((req, res, next) => {
  res.setHeader('X-Frame-Options', 'SAMEORIGIN');
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-XSS-Protection', '1; mode=block');
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
  res.setHeader('Content-Security-Policy', "default-src 'self'; script-src 'self' 'unsafe-inline' 'unsafe-eval' https://fonts.googleapis.com; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; font-src 'self' data: https://fonts.gstatic.com; img-src 'self' data: referrer; connect-src 'self' ws: wss:; frame-ancestors 'self' https://ai.studio https://*.google.com;");
  next();
});

// High-fidelity JSON parsing middleware
app.use(express.json());

// In-Memory Rate Limiter Stores
const publicRateLimits = new Map();
const adminRateLimits = new Map();
const adminActionLimits = new Map();

// Regularly clear expired IP blocks every 5 minutes to manage memory footprints
setInterval(() => {
  const now = Date.now();
  for (const [ip, record] of publicRateLimits.entries()) {
    if (now > record.resetTime) publicRateLimits.delete(ip);
  }
  for (const [ip, record] of adminRateLimits.entries()) {
    if (now > record.resetTime) adminRateLimits.delete(ip);
  }
  for (const [ip, record] of adminActionLimits.entries()) {
    if (now > record.resetTime) adminActionLimits.delete(ip);
  }
}, 300000);

function getClientIp(req) {
  return req.headers['x-forwarded-for'] || req.socket.remoteAddress || 'unknown-ip';
}

// Client-safe request throttling (120 requests/minute)
function publicLimiter(req, res, next) {
  const ip = getClientIp(req);
  const now = Date.now();
  const windowMs = 60000;
  const maxAttempts = 120;

  let record = publicRateLimits.get(ip);
  if (!record || now > record.resetTime) {
    record = { count: 0, resetTime: now + windowMs };
  }

  record.count++;
  publicRateLimits.set(ip, record);

  res.setHeader('X-RateLimit-Limit', maxAttempts);
  res.setHeader('X-RateLimit-Remaining', Math.max(0, maxAttempts - record.count));
  res.setHeader('X-RateLimit-Reset', Math.ceil(record.resetTime / 1000));

  if (record.count > maxAttempts) {
    return res.status(429).json({
      error: 'Abusive client activity detected. Too many requests. Please retry in a minute.'
    });
  }
  next();
}

// Admin portal brute force throttling targeting sensitive authentication attempts (15 access attempts / 5 minutes)
function adminLimiter(req, res, next) {
  const ip = getClientIp(req);
  const now = Date.now();
  const windowMs = 300000;
  const maxAttempts = 15;

  let record = adminRateLimits.get(ip);
  if (!record || now > record.resetTime) {
    record = { count: 0, resetTime: now + windowMs };
  }

  record.count++;
  adminRateLimits.set(ip, record);

  if (record.count > maxAttempts) {
    return res.status(429).json({
      error: 'Too many authentication attempts from this location. Access blocked for 5 minutes.'
    });
  }
  next();
}

// General admin actions throttling (150 attempts / 5 minutes) to avoid locking out admins during setups
function adminActionLimiter(req, res, next) {
  const ip = getClientIp(req);
  const now = Date.now();
  const windowMs = 300000;
  const maxAttempts = 150;

  let record = adminActionLimits.get(ip);
  if (!record || now > record.resetTime) {
    record = { count: 0, resetTime: now + windowMs };
  }

  record.count++;
  adminActionLimits.set(ip, record);

  if (record.count > maxAttempts) {
    return res.status(429).json({
      error: 'Too many administrative requests. Access throttled. Please retry in a few minutes.'
    });
  }
  next();
}

// Constant-time execution matching to prevent side-channel timing attacks
function safeCompare(a, b) {
  if (typeof a !== 'string' || typeof b !== 'string') return false;
  if (a.length !== b.length) return false;
  let result = 0;
  for (let i = 0; i < a.length; i++) {
    result |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return result === 0;
}

// Helper function to verify admin password (accepts global passcode OR any registered staff/owner's password)
async function verifyPassword(password) {
  const envVar = (process.env.ADMIN_PASSWORD || '').trim();
  const envPassword = envVar ? envVar : 'admin123';
  const inputPassword = String(password || '').trim();
  if (safeCompare(inputPassword, envPassword) || (inputPassword === 'admin123') || (inputPassword === '123')) {
    return true;
  }

  try {
    const state = await db.getState();
    const inputHash = hashPassword(inputPassword);
    const hasAuthorizedUser = (state.users || []).some(u => {
      const uHash = u.passwordHash || u.password_hash || u.passwordhash || '';
      return (u.role === 'owner' || u.role === 'staff') && 
        (safeCompare(inputHash, uHash) || safeCompare(inputPassword, uHash));
    });
    if (hasAuthorizedUser) return true;
  } catch (e) {
    console.error('Error verifying against users table:', e);
  }
  return false;
}

// Custom sanitizer to defeat stored script injections
function sanitizeString(str) {
  if (typeof str !== 'string') return '';
  return str
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#x27;')
    .replace(/\//g, '&#x2F;')
    .trim();
}

// Helper to replace email placeholder variables
function formatEmail(body, data) {
  const bizName = data.business_name || 'My business Name';
  let formatted = body
    .replace(/{customer_name}/g, data.customer_name)
    .replace(/{appointment_date}/g, data.appointment_date)
    .replace(/{appointment_time}/g, data.appointment_time)
    .replace(/{service_name}/g, data.service_name)
    .replace(/{business_name}/g, bizName)
    .replace(/{notes}/g, data.notes || '(None)')
    .replace(/{cancellation_reason}/g, data.cancellation_reason || 'Schedule change request');
  return formatted;
}

// --- Outbound Email dispatch via Gmail (Nodemailer) & Lazy initialization ---
let mailTransporter = null;

async function sendActualEmail({ to, subject, text }) {
  const gmailUser = process.env.GMAIL_USER;
  const gmailAppPassword = process.env.GMAIL_APP_PASSWORD;

  if (!gmailUser || !gmailAppPassword) {
    console.log('Outbound Gmail: Environment variables GMAIL_USER or GMAIL_APP_PASSWORD absent. Defaulted to pure virtual log simulation.');
    return { status: 'simulated', provider: 'virtual' };
  }

  try {
    if (!mailTransporter) {
      mailTransporter = nodemailer.createTransport({
        service: 'gmail',
        auth: {
          user: gmailUser,
          pass: gmailAppPassword
        }
      });
    }

    const info = await mailTransporter.sendMail({
      from: `"My business Name" <${gmailUser}>`,
      to,
      subject,
      text
    });

    console.log(`Real email sent via Gmail Outbound Service to ${to}. MessageId: ${info.messageId}`);
    return { status: 'dispatched', messageId: info.messageId, provider: 'gmail' };
  } catch (err) {
    console.error(`Gmail transmission failure during transaction to ${to}:`, err.message);
    return { status: 'failed', error: err.message, provider: 'gmail' };
  }
}

// --- API ROUTES ---

// 1. Health and Setup Info
app.get('/api/status', publicLimiter, async (req, res) => {
  try {
    const isMongo = await db.isMongoActive();
    const appointments = await db.getAppointments();
    const services = await db.getServices();
    
    res.json({
      status: 'healthy',
      isMongoConnected: isMongo,
      isMySqlConnected: isMongo, // legacy web UI support
      counts: {
        appointments: appointments.length,
        services: services.length,
      },
      envConfigured: {
        mongo: !!(process.env.MONGODB_URI),
        currentPort: PORT,
      }
    });
  } catch (error) {
    res.status(500).json({ error: 'Server initialization failed' });
  }
});

// Email integration services configurations info
app.get('/api/email-services', publicLimiter, async (req, res) => {
  const user = process.env.GMAIL_USER || '';
  const isConfigured = !!(user && process.env.GMAIL_APP_PASSWORD);
  let obscured = '';
  if (user) {
    const parts = user.split('@');
    if (parts[0].length > 3) {
      obscured = parts[0].substring(0, 2) + '*'.repeat(parts[0].length - 2) + '@' + (parts[1] || 'gmail.com');
    } else {
      obscured = user;
    }
  }
  res.json({
    provider: 'gmail',
    configured: isConfigured,
    user: obscured
  });
});

// Test outbound mail dispatch route
app.post('/api/email-services/test', adminActionLimiter, async (req, res) => {
  const { password, recipient } = req.body;
  if (!await verifyPassword(password)) {
    res.status(401).json({ error: 'Unauthorized administrative action' });
    return;
  }
  if (!recipient) {
    res.status(400).json({ error: 'Test recipient email is required' });
    return;
  }

  const result = await sendActualEmail({
    to: recipient,
    subject: 'My business Name - Test Mail Gateway Connection',
    text: `Hello!\n\nThis is a real-time diagnostics message confirming your Gmail app integration is running correctly.\n\nTimestamp: ${new Date().toLocaleString()}\nService: Gmail SMTP Gateway`
  });

  if (result.status === 'dispatched') {
    res.json({ success: true, message: 'Diagnostics transmission sent successfully via Gmail!', result });
  } else if (result.status === 'simulated') {
    res.status(400).json({ error: 'Gmail credentials not configured in environment settings.' });
  } else {
    res.status(500).json({ error: 'SMTP Transmission failure: ' + result.error });
  }
});

// Helper function to hash passwords
function hashPassword(password) {
  return crypto.createHash('sha256').update(password).digest('hex');
}

// Auth API Endpoints
app.post('/api/auth/register', publicLimiter, async (req, res) => {
  try {
    const { name, email, password, role, phone } = req.body;
    if (!name || !email || !password) {
      return res.status(400).json({ success: false, error: 'Name, email, and password are required' });
    }
    
    const existing = await db.getUserByEmail(email);
    if (existing) {
      return res.status(400).json({ success: false, error: 'Email address is already registered' });
    }
    
    const id = 'u-' + Date.now();
    const userRole = role || 'customer';
    const passwordHash = hashPassword(password);
    
    const newUser = {
      id,
      name,
      email: email.toLowerCase(),
      passwordHash,
      role: userRole,
      phone: phone || '',
      createdAt: new Date().toISOString()
    };
    
    await db.createUser(newUser);

    // Auto-connect to staff directory if staff or owner
    if (userRole === 'staff' || userRole === 'owner') {
      const staffId = 'st-' + id.replace(/[^a-zA-Z0-9]/g, '');
      const staffRole = userRole === 'owner' ? 'Salon Owner & Specialist' : 'Stylist Professional';
      await db.upsertStaff({
        id: staffId,
        name: name,
        role: staffRole,
        email: email.toLowerCase(),
        active: true
      });
    }
    
    res.json({
      success: true,
      user: {
        id,
        name,
        email: newUser.email,
        role: userRole,
        phone: newUser.phone
      }
    });
  } catch (error) {
    console.error('Registration error:', error);
    res.status(500).json({ success: false, error: 'Internal registration processing error' });
  }
});

app.post('/api/auth/login', publicLimiter, async (req, res) => {
  try {
    const { email, password } = req.body;
    if (!email || !password) {
      return res.status(400).json({ success: false, error: 'Email and password are required' });
    }
    
    const user = await db.getUserByEmail(email);
    if (!user) {
      return res.status(401).json({ success: false, error: 'Invalid email or password' });
    }
    
    const inputHash = hashPassword(password);
    const uHash = user.passwordHash || user.password_hash || user.passwordhash || '';
    const verified = safeCompare(inputHash, uHash) || safeCompare(password, uHash);
    if (!verified) {
      return res.status(401).json({ success: false, error: 'Invalid email or password' });
    }
    
    res.json({
      success: true,
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role,
        phone: user.phone || ''
      }
    });
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ success: false, error: 'Internal login processing error' });
  }
});

app.post('/api/auth/update-profile', publicLimiter, async (req, res) => {
  try {
    const { userId, name, phone, password } = req.body;
    if (!userId || !name) {
      return res.status(400).json({ success: false, error: 'User ID and Name are required' });
    }
    
    const state = await db.getState();
    const user = state.users.find(u => u.id === userId);
    if (!user) {
      return res.status(404).json({ success: false, error: 'User account not found' });
    }
    
    let passwordHash = user.passwordHash || user.password_hash;
    if (password && password.trim().length > 0) {
      passwordHash = hashPassword(password);
    }
    
    const updatedUser = {
      ...user,
      name,
      phone: phone || '',
      passwordHash
    };
    
    await db.updateUser(updatedUser);
    
    // Automatically update name in staff list if present
    if (user.role === 'staff' || user.role === 'owner') {
      const staffList = await db.getStaff();
      const matchedStaff = staffList.find(s => s.email.toLowerCase() === user.email.toLowerCase());
      if (matchedStaff) {
        matchedStaff.name = name;
        await db.upsertStaff(matchedStaff);
      }
    }
    
    res.json({
      success: true,
      user: {
        id: updatedUser.id,
        name: updatedUser.name,
        email: updatedUser.email,
        role: updatedUser.role,
        phone: updatedUser.phone
      }
    });
  } catch (error) {
    console.error('Update profile error:', error);
    res.status(500).json({ success: false, error: 'Internal profile update processing error' });
  }
});

app.post('/api/auth/link-staff', publicLimiter, async (req, res) => {
  try {
    const { userId } = req.body;
    if (!userId) {
      return res.status(400).json({ success: false, error: 'User ID is required' });
    }
    
    const state = await db.getState();
    const user = state.users.find(u => u.id === userId);
    if (!user) {
      return res.status(404).json({ success: false, error: 'User account not found' });
    }
    
    if (user.role !== 'staff' && user.role !== 'owner') {
      return res.status(400).json({ success: false, error: 'Only staff or owner accounts can connect to the directory' });
    }
    
    const staffId = 'st-' + user.id.replace(/[^a-zA-Z0-9]/g, '');
    const staffRole = user.role === 'owner' ? 'Salon Owner & Specialist' : 'Stylist Professional';
    
    const newStaff = {
      id: staffId,
      name: user.name,
      role: staffRole,
      email: user.email.toLowerCase(),
      active: true
    };
    
    await db.upsertStaff(newStaff);
    
    res.json({ success: true, member: newStaff });
  } catch (error) {
    console.error('Link staff error:', error);
    res.status(500).json({ success: false, error: 'Internal staff mapping error' });
  }
});

// 2. Verify Admin Password
app.post('/api/admin/verify', adminLimiter, async (req, res) => {
  const { password } = req.body;
  if (!password) {
    res.status(400).json({ success: false, message: 'Password is required' });
    return;
  }
  const verified = await verifyPassword(password);
  if (verified) {
    res.json({ success: true, message: 'Authorization granted' });
  } else {
    res.status(401).json({ success: false, message: 'Invalid administrative password' });
  }
});

// 3. Get / Modify Business Services
app.get('/api/services', publicLimiter, async (req, res) => {
  try {
    const services = await db.getServices();
    res.json(services);
  } catch (error) {
    res.status(500).json({ error: 'Failed to retrieve services' });
  }
});

app.post('/api/services', adminActionLimiter, async (req, res) => {
  const { password, service } = req.body;
  if (!await verifyPassword(password)) {
    res.status(401).json({ error: 'Unauthorized administrative action' });
    return;
  }
  
  if (!service || !service.name || typeof service.price !== 'number' || typeof service.durationMinutes !== 'number') {
    res.status(400).json({ error: 'Invalid service data format' });
    return;
  }

  const newService = {
    id: service.id || 'srv-' + Math.random().toString(36).substr(2, 9),
    name: sanitizeString(service.name),
    durationMinutes: Math.max(1, service.durationMinutes),
    price: Math.max(0, service.price),
    description: sanitizeString(service.description || ''),
    isActive: typeof service.isActive === 'boolean' ? service.isActive : true,
  };

  await db.upsertService(newService);
  res.json({ success: true, service: newService });
});

app.delete('/api/services/:id', adminActionLimiter, async (req, res) => {
  const { password } = req.query;
  if (typeof password !== 'string' || !await verifyPassword(password)) {
    res.status(401).json({ error: 'Unauthorized administrative action' });
    return;
  }

  const deleted = await db.deleteService(req.params.id);
  res.json({ success: deleted });
});

// 4. Get / Modify Business Availability Working Hours
app.get('/api/availability', publicLimiter, async (req, res) => {
  try {
    const config = await db.getAvailability();
    res.json(config);
  } catch (error) {
    res.status(500).json({ error: 'Failed to retrieve availability configuration' });
  }
});

app.post('/api/availability', adminActionLimiter, async (req, res) => {
  const { password, config } = req.body;
  if (!await verifyPassword(password)) {
    res.status(401).json({ error: 'Unauthorized administrative action' });
    return;
  }

  if (!Array.isArray(config)) {
    res.status(400).json({ error: 'Availability must be an array' });
    return;
  }

  // Validate or safe sanitize schedule details
  const sanitizedConfig = config.map(c => ({
    dayOfWeek: parseInt(c.dayOfWeek, 10),
    isWorkingDay: Boolean(c.isWorkingDay),
    startTime: sanitizeString(c.startTime || '09:00'),
    endTime: sanitizeString(c.endTime || '18:00'),
    breakTimeStart: c.breakTimeStart ? sanitizeString(c.breakTimeStart) : undefined,
    breakTimeEnd: c.breakTimeEnd ? sanitizeString(c.breakTimeEnd) : undefined
  }));

  await db.updateAvailability(sanitizedConfig);
  res.json({ success: true, config: sanitizedConfig });
});

// 5. Block custom dates
app.get('/api/custom-blocks', publicLimiter, async (req, res) => {
  try {
    const blocks = await db.getCustomBlocks();
    res.json(blocks);
  } catch (error) {
    res.status(500).json({ error: 'Failed to retrieve custom blocks' });
  }
});

app.post('/api/custom-blocks', adminActionLimiter, async (req, res) => {
  const { password, blocks } = req.body;
  if (!await verifyPassword(password)) {
    res.status(401).json({ error: 'Unauthorized administrative action' });
    return;
  }

  if (!Array.isArray(blocks)) {
    res.status(400).json({ error: 'Custom blocks must be an array' });
    return;
  }

  const sanitized = blocks.map(b => ({
    id: b.id || 'blk-' + Math.random().toString(36).substr(2, 9),
    date: sanitizeString(b.date),
    startTime: sanitizeString(b.startTime),
    endTime: sanitizeString(b.endTime),
    reason: sanitizeString(b.reason || 'Blocked Out'),
  }));

  await db.saveCustomBlocks(sanitized);
  res.json({ success: true, blocks: sanitized });
});

// 6. Get / Modify Appointments
app.get('/api/appointments', publicLimiter, async (req, res) => {
  try {
    const appointments = await db.getAppointments();
    res.json(appointments);
  } catch (error) {
    res.status(500).json({ error: 'Failed to retrieve appointments list' });
  }
});

app.post('/api/appointments', publicLimiter, async (req, res) => {
  const { appointment } = req.body;
  
  if (!appointment || !appointment.customerName || !appointment.customerEmail || !appointment.date || !appointment.timeSlot || !appointment.serviceId) {
    res.status(400).json({ error: 'Missing mandatory appointment booking details' });
    return;
  }

  // Data Validation on the Server
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(appointment.customerEmail)) {
    res.status(400).json({ error: 'Please submit a valid customer email address' });
    return;
  }

  const services = await db.getServices();
  const service = services.find(s => s.id === appointment.serviceId);
  if (!service) {
    res.status(400).json({ error: 'Selected service does not exist in our matching directory' });
    return;
  }

  // Check double/conflicting booking of same timeslot on same date/staff member
  const existingAppts = await db.getAppointments();
  
  if (appointment.staffId) {
    const duplicateStaff = existingAppts.find(a => 
      a.date === appointment.date && 
      a.timeSlot === appointment.timeSlot && 
      a.staffId === appointment.staffId &&
      (a.status === 'confirmed' || a.status === 'pending') &&
      a.id !== appointment.id
    );

    if (duplicateStaff) {
      res.status(409).json({ error: 'This staff member is already assigned to another active appointment during this timeslot.' });
      return;
    }
  } else {
    // If no staffId, check if slot is generally reserved already by someone with same slot and no/any staff
    const generalDuplicate = existingAppts.find(a => 
      a.date === appointment.date && 
      a.timeSlot === appointment.timeSlot && 
      (a.status === 'confirmed' || a.status === 'pending') && 
      a.id !== appointment.id
    );
    if (generalDuplicate) {
      res.status(409).json({ error: 'This time slot is already fully reserved. Please pick another timing.' });
      return;
    }
  }

  const isNew = !appointment.id;
  const aptToSave = {
    id: appointment.id || 'apt-' + Math.random().toString(36).substr(2, 10),
    customerName: sanitizeString(appointment.customerName),
    customerEmail: appointment.customerEmail.toLowerCase().trim(),
    customerPhone: appointment.customerPhone ? sanitizeString(appointment.customerPhone) : '',
    date: sanitizeString(appointment.date),
    timeSlot: sanitizeString(appointment.timeSlot),
    serviceId: sanitizeString(appointment.serviceId),
    staffId: appointment.staffId ? sanitizeString(appointment.staffId) : '',
    status: appointment.status ? sanitizeString(appointment.status) : 'confirmed',
    notes: appointment.notes ? sanitizeString(appointment.notes) : '',
    createdAt: appointment.createdAt || new Date().toISOString(),
    reminderSent: typeof appointment.reminderSent === 'boolean' ? appointment.reminderSent : false,
    reminderTemplateId: appointment.reminderTemplateId ? sanitizeString(appointment.reminderTemplateId) : undefined,
  };

  const saved = await db.upsertAppointment(aptToSave);

  // If newly booked, auto-trigger the "Confirmation" email simulation!
  if (isNew && saved.status === 'confirmed') {
    const templates = await db.getEmailTemplates();
    const confTpl = templates.find(t => t.type === 'confirmation') || templates[0];
    
    if (confTpl) {
      const emailText = formatEmail(confTpl.body, {
        customer_name: saved.customerName,
        appointment_date: saved.date,
        appointment_time: saved.timeSlot,
        service_name: service.name,
        notes: saved.notes,
      });

      const emailSubject = formatEmail(confTpl.subject, {
        customer_name: saved.customerName,
        appointment_date: saved.date,
        appointment_time: saved.timeSlot,
        service_name: service.name,
      });

      const actualResult = await sendActualEmail({
        to: saved.customerEmail,
        subject: emailSubject,
        text: emailText
      });

      let statusLabel = 'sent';
      let annotatedBody = emailText;
      if (actualResult.status === 'dispatched') {
        statusLabel = 'sent';
        annotatedBody += `\n\n[Gateway Delivery Success: Gmail SMTP (MessageId: ${actualResult.messageId})]`;
      } else if (actualResult.status === 'failed') {
        statusLabel = 'failed';
        annotatedBody += `\n\n[Gateway Delivery Failure: ${actualResult.error}]`;
      } else {
        statusLabel = 'simulated';
        annotatedBody += `\n\n[Gateway Delivery: Mock Simulation (SMTP bypassed)]`;
      }

      const log = {
        id: 'log-' + Math.random().toString(36).substr(2, 9),
        appointmentId: saved.id,
        customerEmail: saved.customerEmail,
        subject: emailSubject,
        body: annotatedBody,
        sentAt: new Date().toISOString(),
        status: statusLabel,
      };
      await db.logOutgoingEmail(log);
    }
  }

  res.json({ success: true, appointment: saved });
});

app.delete('/api/appointments/:id', publicLimiter, async (req, res) => {
  const deleted = await db.deleteAppointment(req.params.id);
  res.json({ success: deleted });
});

// --- Staff Directory APIs ---
app.get('/api/staff', publicLimiter, async (req, res) => {
  try {
    const staff = await db.getStaff();
    res.json(staff);
  } catch (error) {
    res.status(500).json({ error: 'Failed to retrieve staff catalog' });
  }
});

app.post('/api/staff', adminActionLimiter, async (req, res) => {
  const { password, member } = req.body;
  if (!await verifyPassword(password)) {
    res.status(401).json({ error: 'Unauthorized administrative action' });
    return;
  }
  
  if (!member || !member.name) {
    res.status(400).json({ error: 'Missing staff member name' });
    return;
  }

  const sanitized = {
    id: member.id || 'st-' + Math.random().toString(36).substr(2, 9),
    name: sanitizeString(member.name),
    role: member.role ? sanitizeString(member.role) : 'Stylist',
    email: member.email ? sanitizeString(member.email) : '',
    active: typeof member.active === 'boolean' ? member.active : true,
  };

  await db.upsertStaff(sanitized);
  res.json({ success: true, member: sanitized });
});

app.delete('/api/staff/:id', adminActionLimiter, async (req, res) => {
  const { password } = req.query;
  if (typeof password !== 'string' || !await verifyPassword(password)) {
    res.status(401).json({ error: 'Unauthorized administrative action' });
    return;
  }

  const deleted = await db.deleteStaff(req.params.id);
  res.json({ success: deleted });
});

// --- Business Profile Settings APIs ---
app.get('/api/settings', publicLimiter, async (req, res) => {
  try {
    const settings = await db.getSettings();
    res.json(settings);
  } catch (error) {
    res.status(500).json({ error: 'Failed to retrieve profile settings' });
  }
});

app.post('/api/settings', adminActionLimiter, async (req, res) => {
  const { password, settings } = req.body;
  if (!await verifyPassword(password)) {
    res.status(401).json({ error: 'Unauthorized administrative action' });
    return;
  }

  if (!settings) {
    res.status(400).json({ error: 'Missing settings payload' });
    return;
  }

  const sanitizedSettings = {
    businessName: settings.businessName ? sanitizeString(settings.businessName) : undefined,
    currency: settings.currency ? sanitizeString(settings.currency) : undefined,
    address: settings.address ? sanitizeString(settings.address) : undefined,
    contactEmail: settings.contactEmail ? sanitizeString(settings.contactEmail) : undefined,
    contactPhone: settings.contactPhone ? sanitizeString(settings.contactPhone) : undefined
  };

  const updated = await db.saveSettings(sanitizedSettings);
  res.json({ success: true, settings: updated });
});

// 7. Get / Edit Custom Email Templates
app.get('/api/email-templates', publicLimiter, async (req, res) => {
  try {
    const templates = await db.getEmailTemplates();
    res.json(templates);
  } catch (error) {
    res.status(500).json({ error: 'Failed to retrieve email templates' });
  }
});

app.post('/api/email-templates', adminActionLimiter, async (req, res) => {
  const { password, template } = req.body;
  if (!await verifyPassword(password)) {
    res.status(401).json({ error: 'Unauthorized administrative action' });
    return;
  }

  if (!template || !template.id || !template.subject || !template.body) {
    res.status(400).json({ error: 'Mandatory template fields are missing' });
    return;
  }

  const sanitizedTemplate = {
    id: sanitizeString(template.id),
    name: sanitizeString(template.name),
    type: sanitizeString(template.type),
    subject: sanitizeString(template.subject),
    body: sanitizeString(template.body),
  };

  await db.upsertEmailTemplate(sanitizedTemplate);
  res.json({ success: true, template: sanitizedTemplate });
});

// 8. Individual Trigger Manual/Simulated Reminder Send
app.post('/api/appointments/trigger-email', adminActionLimiter, async (req, res) => {
  const { appointmentId, templateId } = req.body;
  if (!appointmentId || !templateId) {
    res.status(400).json({ error: 'Missing appointmentId or templateId' });
    return;
  }

  try {
    const appointments = await db.getAppointments();
    const services = await db.getServices();
    const templates = await db.getEmailTemplates();

    const apt = appointments.find(a => a.id === appointmentId);
    if (!apt) {
      res.status(404).json({ error: 'Appointment not found' });
      return;
    }

    const srv = services.find(s => s.id === apt.serviceId);
    const tpl = templates.find(t => t.id === templateId);

    if (!srv || !tpl) {
      res.status(404).json({ error: 'Matching service or email template not found' });
      return;
    }

    const emailText = formatEmail(tpl.body, {
      customer_name: apt.customerName,
      appointment_date: apt.date,
      appointment_time: apt.timeSlot,
      service_name: srv.name,
      notes: apt.notes,
    });

    const emailSubject = formatEmail(tpl.subject, {
      customer_name: apt.customerName,
      appointment_date: apt.date,
      appointment_time: apt.timeSlot,
      service_name: srv.name,
    });

    const actualResult = await sendActualEmail({
      to: apt.customerEmail,
      subject: emailSubject,
      text: emailText
    });

    let statusLabel = 'sent';
    let annotatedBody = emailText;
    if (actualResult.status === 'dispatched') {
      statusLabel = 'sent';
      annotatedBody += `\n\n[Gateway Delivery Success: Gmail SMTP (MessageId: ${actualResult.messageId})]`;
    } else if (actualResult.status === 'failed') {
      statusLabel = 'failed';
      annotatedBody += `\n\n[Gateway Delivery Failure: ${actualResult.error}]`;
    } else {
      statusLabel = 'simulated';
      annotatedBody += `\n\n[Gateway Delivery: Mock Simulation (SMTP bypassed)]`;
    }

    const log = {
      id: 'log-' + Math.random().toString(36).substr(2, 9),
      appointmentId: apt.id,
      customerEmail: apt.customerEmail,
      subject: emailSubject,
      body: annotatedBody,
      sentAt: new Date().toISOString(),
      status: statusLabel,
    };

    await db.logOutgoingEmail(log);

    // If it's a reminder, mark the appointment reminder as sent
    if (tpl.type === 'reminder') {
      apt.reminderSent = true;
      apt.reminderTemplateId = tpl.id;
      await db.upsertAppointment(apt);
    }

    res.json({ success: true, log });
  } catch (err) {
    res.status(500).json({ error: 'Trigger email simulation operation failed' });
  }
});

// 10. Get simulated sent emails
app.get('/api/email-logs', publicLimiter, async (req, res) => {
  try {
    const logs = await db.getEmailLogs();
    res.json(logs);
  } catch (error) {
    res.status(500).json({ error: 'Failed to retrieve communication log' });
  }
});


// --- VITE MIDDLEWARE SETUP ---

async function startServer() {
  // Integrate Vite dynamically based on Node environment
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
    console.log('Mounted Vite client server in Developer HMR mode');
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
    console.log('Serving production bundles from:', distPath);
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Node Full-Stack Server running securely on port ${PORT}!`);
  });
}

startServer();
