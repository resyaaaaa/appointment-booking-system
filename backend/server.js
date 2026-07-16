import express from 'express';
import dotenv from 'dotenv';
import nodemailer from 'nodemailer';
import crypto from 'crypto';
import path from 'path';
import cors from 'cors';
import { db, getPool } from './server/db.js';

// Load .env
dotenv.config();

const app = express();
const PORT = process.env.PORT || 5000;

/* =========================
   MYSQL INIT (SAFE)
========================= */

function logDbMode() {
  const pool = getPool();
  if (pool) {
    console.log('MySQL is active');
  } else {
    console.log('Running in JSON fallback mode');
  }
}

/* =========================
   SECURITY MIDDLEWARE
========================= */

app.use((req, res, next) => {
  res.setHeader('X-Frame-Options', 'SAMEORIGIN');
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
  next();
});

app.use(express.json());

// In-memory rate limiter stores
const publicRateLimits = new Map();
const adminRateLimits = new Map();
const adminActionLimits = new Map();

// Regularly clear expired IP blocks every 5 minutes
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

// Client-safe request throttling 
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

// Admin portal brute force throttling 
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

// General admin actions throttling 
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

// Verify admin password
async function verifyPassword(password) {
  const inputPassword = String(password || '').trim();
  if (!inputPassword) return false;


  const envVar = (process.env.ADMIN_PASSWORD || '').trim();
  const envPassword = envVar ? envVar : 'admin123';

  if (safeCompare(inputPassword, envPassword)) {
    return true;
  }


  const pool = getPool();
  if (!pool) return false;

  try {
    const inputHash = hashPassword(inputPassword);


    const [users] = await pool.query(
      'SELECT passwordHash, role FROM users WHERE role IN ("owner", "staff")'
    );


    const hasAuthorizedUser = users.some(u => {
      const dbHash = u.passwordHash || u.password_hash || u.passwordhash || '';
      return safeCompare(inputHash, dbHash);
    });

    if (hasAuthorizedUser) return true;
  } catch (e) {
    console.error('Error verifying against users table:', e.message);
  }

  return false;
}

/* =========================
   HELPERS
========================= */

function hashPassword(password) {
  return crypto.createHash('sha256').update(password).digest('hex');
}

function safeCompare(a, b) {
  if (typeof a !== 'string' || typeof b !== 'string') return false;
  if (a.length !== b.length) return false;

  let result = 0;
  for (let i = 0; i < a.length; i++) {
    result |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return result === 0;
}

function sanitizeString(str) {
  if (typeof str !== 'string') return '';
  return str.trim();
}

function formatEmail(body, data) {
  const bizName = data.business_name || 'Business Name';
  return body
    .replace(/{customer_name}/g, data.customer_name || '')
    .replace(/{appointment_date}/g, data.appointment_date || '')
    .replace(/{appointment_time}/g, data.appointment_time || '')
    .replace(/{service_name}/g, data.service_name || '')
    .replace(/{business_name}/g, bizName)
    .replace(/{notes}/g, data.notes || '')
    .replace(/{cancellation_reason}/g, data.cancellation_reason || 'Schedule change request');
}

/* =========================
   EMAIL SETUP
========================= */

let mailTransporter = null;

async function sendActualEmail({ to, subject, text }) {
  const user = process.env.GMAIL_USER;
  const pass = process.env.GMAIL_APP_PASSWORD;

  if (!user || !pass) {
    return { status: 'failed', provider: 'missing_env' };
  }

  if (!mailTransporter) {
    mailTransporter = nodemailer.createTransport({
      service: 'gmail',
      auth: { user, pass }
    });
  }

  try {
    const info = await mailTransporter.sendMail({
      from: user,
      to,
      subject,
      text
    });

    return { status: 'dispatched', messageId: info.messageId };
  } catch (err) {
    return { status: 'failed', error: err.message };
  }
}

// `````````````` API ROUTES `````````````````

app.get('/api/email-services', publicLimiter, async (req, res) => {
  const user = process.env.GMAIL_USER || '';
  const isConfigured = !!(user && process.env.GMAIL_APP_PASSWORD);
  let hidden = '';
  if (user) {
    const parts = user.split('@');
    if (parts[0].length > 3) {
      hidden = parts[0].substring(0, 2) + '*'.repeat(parts[0].length - 2) + '@' + (parts[1] || 'gmail.com');
    } else {
      hidden = user;
    }
  }
  res.json({
    provider: 'gmail',
    configured: isConfigured,
    user: hidden
  });
});

// Register user
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

    const id = 'u' + Date.now();
    const userRole = role || 'staff';
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

    if (userRole === 'staff' || userRole === 'owner') {
      const staffId = 'st' + id.replace(/[^a-zA-Z0-9]/g, '');
      const staffRole = userRole === 'owner' ? 'Business Owner' : 'Staff';
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
  } catch (err) {
    console.error('Registration error:', err);
    res.status(500).json({ success: false, error: 'Registration processing error' });
  }
});

// Login
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
    // FIX: Accounted for multiple variants of field normalization coming back from custom wrapper/DB drivers
    const uHash = user.passwordHash || user.password_hash || user.passwordhash || '';

    const verified = safeCompare(inputHash, uHash);
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
  } catch (err) {
    console.error('Login error:', err);
    res.status(500).json({ success: false, error: 'Login processing error' });
  }
});

// Manage Profile
app.post('/api/auth/update-profile', publicLimiter, async (req, res) => {
  try {
    const { userId, name, phone, password } = req.body;
    if (!userId || !name) {
      return res.status(400).json({ success: false, error: 'Missing mandatory fields' });
    }

    // FIX: Fetch the user record from database first to avoid using an undefined object reference
    const users = await db.getState ? (await db.getState()).users : [];
    let user = users?.find(u => u.id === userId) || await db.getUserByEmail(userId);

    if (!user) {
      return res.status(404).json({ success: false, error: 'User account not found' });
    }

    let passwordHash = user.passwordHash || user.password_hash || user.passwordhash || '';
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
  } catch (err) {
    console.error('Update profile error:', err);
    res.status(500).json({ success: false, error: 'Profile update processing error' });
  }
});

// Sync staff
app.post('/api/auth/link-staff', publicLimiter, async (req, res) => {
  try {
    const { userId } = req.body;
    if (!userId) {
      return res.status(400).json({ success: false, error: 'User ID is required' });
    }

    const state = await db.getState();
    const user = state.users?.find(u => u.id === userId);

    if (!user) {
      return res.status(404).json({ success: false, error: 'User account not found' });
    }

    if (user.role !== 'staff' && user.role !== 'owner') {
      return res.status(403).json({ success: false, error: 'User not allowed for staff mapping' });
    }

    const staffId = 'st' + user.id.replace(/[^a-zA-Z0-9]/g, '');
    const staffRole = user.role === 'owner' ? 'Business Owner' : 'Staff';

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

// Verify admin password endpoint
app.post('/api/admin/verify', adminLimiter, async (req, res) => {
  const { password } = req.body;
  if (!password) {
    return res.status(400).json({ success: false, message: 'Password is required' });
  }
  const verified = await verifyPassword(password);
  if (verified) {
    return res.json({ success: true, message: 'Authorization granted' });
  } else {
    return res.status(401).json({ success: false, error: 'Invalid admin password' });
  }
});

// Get services
app.get('/api/services', publicLimiter, async (req, res) => {
  try {
    const services = await db.getServices();
    res.json(services);
  } catch (error) {
    return res.status(500).json({ error: 'Failed to retrieve services' });
  }
});

// Create / Update services
app.post('/api/services', adminActionLimiter, async (req, res) => {
  const { password, service } = req.body;
  if (!await verifyPassword(password)) {
    return res.status(401).json({ success: false, error: 'Unauthorized administrative action' });
  }

  if (!service || !service.name || typeof service.price !== 'number' || typeof service.durationMinutes !== 'number') {
    return res.status(400).json({ success: false, error: 'Invalid service data format' });
  }

  const newService = {
    id: service.id || 'srv' + Math.random().toString(36).substring(2, 9),
    name: sanitizeString(service.name),
    durationMinutes: Math.max(1, service.durationMinutes),
    price: Math.max(0, service.price),
    description: sanitizeString(service.description || ''),
    isActive: typeof service.isActive === 'boolean' ? service.isActive : true,
  };

  await db.upsertService(newService);
  return res.json({ success: true, message: 'Service updated successfully', service: newService });
});

// Delete services
app.delete('/api/services/:id', adminActionLimiter, async (req, res) => {
  const { password } = req.query;
  if (typeof password !== 'string' || !await verifyPassword(password)) {
    return res.status(401).json({ success: false, error: 'Unauthorized administrative action' });
  }

  const deleted = await db.deleteService(req.params.id);
  res.json({ success: deleted, message: 'Deleted service successfully' });
});

// Get availability configuration
app.get('/api/availability', publicLimiter, async (req, res) => {
  try {
    const config = await db.getAvailability();
    return res.json(config);
  } catch (error) {
    return res.status(500).json({ success: false, error: 'Failed to retrieve availability configuration' });
  }
});

// Update availability configuration
app.post('/api/availability', adminActionLimiter, async (req, res) => {
  const { password, config } = req.body;
  if (!await verifyPassword(password)) {
    return res.status(401).json({ success: false, error: 'Unauthorized administrative action' });
  }

  if (!Array.isArray(config)) {
    return res.status(400).json({ success: false, error: 'Availability must be an array' });
  }

  const sanitizedConfig = config.map(c => ({
    dayOfWeek: parseInt(c.dayOfWeek, 10),
    isWorkingDay: Boolean(c.isWorkingDay),
    startTime: sanitizeString(c.startTime || '09:00'),
    endTime: sanitizeString(c.endTime || '18:00'),
    breakTimeStart: c.breakTimeStart ? sanitizeString(c.breakTimeStart) : undefined,
    breakTimeEnd: c.breakTimeEnd ? sanitizeString(c.breakTimeEnd) : undefined
  }));

  await db.updateAvailability(sanitizedConfig);
  return res.json({ success: true, config: sanitizedConfig });
});

// Get custom blocks
app.get('/api/custom-blocks', publicLimiter, async (req, res) => {
  try {
    const blocks = await db.getCustomBlocks();
    return res.json(blocks);
  } catch (error) {
    return res.status(500).json({ success: false, error: 'Failed to retrieve custom blocks' });
  }
});

// Update custom blocks
app.post('/api/custom-blocks', adminActionLimiter, async (req, res) => {
  const { password, blocks } = req.body;
  if (!await verifyPassword(password)) {
    return res.status(401).json({ success: false, error: 'Unauthorized administrative action' });
  }

  if (!Array.isArray(blocks)) {
    return res.status(400).json({ success: false, error: 'Custom blocks must be an array' });
  }

  const sanitized = blocks.map(b => ({
    id: b.id || 'blk' + Math.random().toString(36).substring(2, 9),
    date: sanitizeString(b.date),
    startTime: sanitizeString(b.startTime),
    endTime: sanitizeString(b.endTime),
    reason: sanitizeString(b.reason || 'Blocked')
  }));

  await db.saveCustomBlocks(sanitized);
  return res.json({ success: true, blocks: sanitized });
});

// Get Appointments
app.get('/api/appointments', publicLimiter, async (req, res) => {
  try {
    const appointments = await db.getAppointments();
    res.json(appointments);
  } catch (error) {
    res.status(500).json({ error: 'Failed to retrieve appointments list' });
  }
});

// Create/Update Appointment
app.post('/api/appointments', publicLimiter, async (req, res) => {
  const { appointment } = req.body;

  if (!appointment || !appointment.customerName || !appointment.customerEmail || !appointment.date || !appointment.timeSlot || !appointment.serviceId) {
    return res.status(400).json({ error: 'Missing mandatory appointment booking details' });
  }

  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(appointment.customerEmail)) {
    return res.status(400).json({ error: 'Please submit a valid customer email address' });
  }

  const services = await db.getServices();
  const service = services.find(s => s.id === appointment.serviceId);
  if (!service) {
    return res.status(400).json({ error: 'Selected service does not exist in our matching directory' });
  }

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
      return res.status(409).json({ error: 'This staff member is already assigned to another active appointment during this timeslot.' });
    }
  } else {
    const generalDuplicate = existingAppts.find(a =>
      a.date === appointment.date &&
      a.timeSlot === appointment.timeSlot &&
      (a.status === 'confirmed' || a.status === 'pending') &&
      a.id !== appointment.id
    );
    if (generalDuplicate) {
      return res.status(409).json({ error: 'This time slot is already fully reserved. Please pick another timing.' });
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

// Delete Appointment
app.delete('/api/appointments/:id', publicLimiter, async (req, res) => {
  const deleted = await db.deleteAppointment(req.params.id);
  res.json({ success: deleted });
});

// Get Staff Catalogue
app.get('/api/staff', publicLimiter, async (req, res) => {
  try {
    const staff = await db.getStaff();
    res.json(staff);
  } catch (error) {
    res.status(500).json({ error: 'Failed to retrieve staff catalog' });
  }
});

// Upsert Staff
app.post('/api/staff', adminActionLimiter, async (req, res) => {
  const { password, member } = req.body;
  if (!await verifyPassword(password)) {
    return res.status(401).json({ error: 'Unauthorized administrative action' });
  }

  if (!member || !member.name) {
    return res.status(400).json({ error: 'Missing staff member name' });
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

// Delete Staff
app.delete('/api/staff/:id', adminActionLimiter, async (req, res) => {
  const { password } = req.query;
  if (typeof password !== 'string' || !await verifyPassword(password)) {
    return res.status(401).json({ error: 'Unauthorized administrative action' });
  }

  const deleted = await db.deleteStaff(req.params.id);
  res.json({ success: deleted });
});

// Get Business Profile Settings
app.get('/api/settings', publicLimiter, async (req, res) => {
  try {
    const settings = await db.getSettings();
    res.json(settings);
  } catch (error) {
    res.status(500).json({ error: 'Failed to retrieve profile settings' });
  }
});

// Save Settings
app.post('/api/settings', adminActionLimiter, async (req, res) => {
  const { password, settings } = req.body;
  if (!await verifyPassword(password)) {
    return res.status(401).json({ error: 'Unauthorized administrative action' });
  }

  if (!settings) {
    return res.status(400).json({ error: 'Missing settings payload' });
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

// Get Custom Email Templates
app.get('/api/email-templates', publicLimiter, async (req, res) => {
  try {
    const templates = await db.getEmailTemplates();
    res.json(templates);
  } catch (error) {
    res.status(500).json({ error: 'Failed to retrieve email templates' });
  }
});

// Update Email Templates
app.post('/api/email-templates', adminActionLimiter, async (req, res) => {
  const { password, template } = req.body;
  if (!await verifyPassword(password)) {
    return res.status(401).json({ error: 'Unauthorized administrative action' });
  }

  if (!template || !template.id || !template.subject || !template.body) {
    return res.status(400).json({ error: 'Mandatory template fields are missing' });
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

// Manual/Simulated Reminder Trigger
app.post('/api/appointments/trigger-email', adminActionLimiter, async (req, res) => {
  const { appointmentId, templateId } = req.body;
  if (!appointmentId || !templateId) {
    return res.status(400).json({ error: 'Missing appointmentId or templateId' });
  }

  try {
    const appointments = await db.getAppointments();
    const services = await db.getServices();
    const templates = await db.getEmailTemplates();

    const apt = appointments.find(a => a.id === appointmentId);
    if (!apt) {
      return res.status(404).json({ error: 'Appointment not found' });
    }

    const srv = services.find(s => s.id === apt.serviceId);
    const tpl = templates.find(t => t.id === templateId);

    if (!srv || !tpl) {
      return res.status(404).json({ error: 'Matching service or email template not found' });
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

// Get logs
app.get('/api/email-logs', publicLimiter, async (req, res) => {
  try {
    const logs = await db.getEmailLogs();
    res.json(logs);
  } catch (error) {
    res.status(500).json({ error: 'Failed to retrieve communication log' });
  }
});

/* =========================
   VITE + SERVER START
========================= */

app.use(cors({
  origin: [
    //"http://localhost:5173",
    process.env.FRONTEND_URL,
  ],
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  credentials: true
}));

app.use(express.json());

app.get("/", (req, res) => {
  res.send("Backend API is running");
});

function startServer() {
  logDbMode();

  app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
  });
}

startServer();