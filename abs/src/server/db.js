import fs from 'fs';
import path from 'path';
import mysql from 'mysql2/promise';

const DB_DIR = path.join(process.cwd(), 'data');
const DB_FILE = path.join(DB_DIR, 'appointment_db.json');

// Default initial data for small businesses
const INITIAL_STATE = {
  appointments: [],
  services: [
    {
      id: 's1',
      name: 'Deluxe Haircut & Styling',
      durationMinutes: 45,
      price: 45.00,
      description: 'Signature haircut, shampoo wash, scalp massage, and custom blow-dry blow styling.',
      isActive: true,
    },
    {
      id: 's2',
      name: 'Premium Beard Grooming',
      durationMinutes: 30,
      price: 30.00,
      description: 'Hot towel prep, detailed straight-razor lineup, trimming, and organic beard oil treatment.',
      isActive: true,
    },
    {
      id: 's3',
      name: 'The Royal Service (Combo)',
      durationMinutes: 75,
      price: 70.00,
      description: 'Deluxe haircut combined with Premium Beard Grooming and a refreshing charcoal peeling mask.',
      isActive: true,
    },
    {
      id: 's4',
      name: 'Classic Face Massage & Facial',
      durationMinutes: 45,
      price: 50.00,
      description: 'Rejuvenating mud mask, steaming hot towels, facial massage, and hydrating sunscreen application.',
      isActive: true,
    },
  ],
  availability: [
    // 0 = Sunday (Closed)
    { dayOfWeek: 0, isWorkingDay: false, startTime: '09:00', endTime: '17:00' },
    // Mon-Fri: 9:00 AM - 6:00 PM, break 12:00 - 13:00
    { dayOfWeek: 1, isWorkingDay: true, startTime: '09:00', endTime: '18:00', breakTimeStart: '12:00', breakTimeEnd: '13:00' },
    { dayOfWeek: 2, isWorkingDay: true, startTime: '09:00', endTime: '18:00', breakTimeStart: '12:00', breakTimeEnd: '13:00' },
    { dayOfWeek: 3, isWorkingDay: true, startTime: '09:00', endTime: '18:00', breakTimeStart: '12:00', breakTimeEnd: '13:00' },
    { dayOfWeek: 4, isWorkingDay: true, startTime: '09:00', endTime: '18:00', breakTimeStart: '12:00', breakTimeEnd: '13:00' },
    { dayOfWeek: 5, isWorkingDay: true, startTime: '09:00', endTime: '18:00', breakTimeStart: '12:00', breakTimeEnd: '13:00' },
    // Saturday: 9:00 AM - 4:00 PM (No break)
    { dayOfWeek: 6, isWorkingDay: true, startTime: '09:00', endTime: '16:00' },
  ],
  customBlocks: [],
  emailTemplates: [
    {
      id: 'tpl-conf',
      name: 'Standard Booking Confirmation',
      type: 'confirmation',
      subject: 'Reservation Confirmed: {service_name} with {business_name}',
      body: 'Hello {customer_name},\n\nYour appointment is confirmed!\n\n✨ Service: {service_name}\n📅 Date: {appointment_date}\n🕒 Time: {appointment_time}\n\n✂️ Staff Notes: {notes}\n\nWe look forward to giving you an exceptional experience. If you need to make corrections, reply to this email or call us directly!\n\nBest regards,\nThe Team at {business_name}'
    },
    {
      id: 'tpl-rem',
      name: 'Day-Before Appointment Reminder',
      type: 'reminder',
      subject: 'Reminder: Your upcoming reservation at {business_name} tomorrow',
      body: 'Hi {customer_name},\n\nWe are looking forward to seeing you tomorrow for your appointment!\n\n🔹 Business: {business_name}\n🔹 Service: {service_name}\n📅 Date: {appointment_date}\n🕒 Time: {appointment_time}\n\nLocation: 404 Design District, Suite 300\n\nIf you must reschedule, please give us a courtesy heads-up.\n\nWarmly,\n{business_name}'
    },
    {
      id: 'tpl-can',
      name: 'Appointment Cancellation Alert',
      type: 'cancellation',
      subject: 'Cancellation Notice: {service_name} reschedule options',
      body: 'Hello {customer_name},\n\nYour scheduled appointment on {appointment_date} at {appointment_time} for "{service_name}" has been successfully cancelled.\n\nIf this was done in error or you would like to book a different slot, please reply to this alert or schedule on our web portal.\n\nSincerely,\n{business_name}'
    }
  ],
  emailLogs: [],
  staff: [
    { id: 'st-1', name: 'Jordan Lee', role: 'Stylist Professional', email: 'jordan@example.com', active: true }
  ],
  settings: {
    businessName: 'My Business Name',
    currency: 'RM',
    address: '404 Design District, Suite 300',
    contactEmail: 'contact@example.com',
    contactPhone: '555-0100'
  }
};

// Ensure the local database directory and file exist
function initializeLocalDB() {
  if (!fs.existsSync(DB_DIR)) {
    fs.mkdirSync(DB_DIR, { recursive: true });
  }
  if (!fs.existsSync(DB_FILE)) {
    fs.writeFileSync(DB_FILE, JSON.stringify(INITIAL_STATE, null, 2), 'utf8');
    return INITIAL_STATE;
  }
  try {
    const raw = fs.readFileSync(DB_FILE, 'utf8');
    const parsed = JSON.parse(raw);
    
    // Ensure all keys exist
    const merged = { ...INITIAL_STATE, ...parsed };
    if (!merged.staff) merged.staff = INITIAL_STATE.staff;
    if (!merged.settings) merged.settings = INITIAL_STATE.settings;
    return merged;
  } catch (e) {
    console.error('Error reading local file database. Resetting to initial state.', e);
    fs.writeFileSync(DB_FILE, JSON.stringify(INITIAL_STATE, null, 2), 'utf8');
    return INITIAL_STATE;
  }
}

// Local State Store mapping
let localState = initializeLocalDB();

// Sync functions to persist current state
function saveLocalDB(state) {
  try {
    localState = state;
    fs.writeFileSync(DB_FILE, JSON.stringify(state, null, 2), 'utf8');
  } catch (e) {
    console.error('Failed to write to local DB file:', e);
  }
}

// --- MySQL Setup and Integration ---
let pool = null;
let isMySqlActiveStatus = null; // null = uninitialized, false = failed, true = active
let isMySqlConfigured = false;

const mysqlHost = process.env.MYSQL_HOST || '';
const mysqlUser = process.env.MYSQL_USER || '';
const mysqlPassword = process.env.MYSQL_PASSWORD || '';
const mysqlDatabase = process.env.MYSQL_DATABASE || '';
const mysqlPort = process.env.MYSQL_PORT || '3306';

if (mysqlHost && mysqlUser && mysqlDatabase) {
  isMySqlConfigured = true;
  try {
    pool = mysql.createPool({
      host: mysqlHost,
      user: mysqlUser,
      password: mysqlPassword,
      database: mysqlDatabase,
      port: parseInt(mysqlPort, 10),
      waitForConnections: true,
      connectionLimit: 10,
      queueLimit: 0,
      connectTimeout: 5000 // 5 seconds fail fast
    });
    console.log('MySQL Connection pool instantiated.');
  } catch (err) {
    console.error('Failed to create MySQL pool:', err);
  }
}

async function ensureMySqlTables() {
  if (!pool) {
    isMySqlActiveStatus = false;
    return false;
  }
  if (isMySqlActiveStatus === true) return true;

  try {
    // Ping to verify connection is active
    await pool.query('SELECT 1');

    console.log('Verifying or creating MySQL database tables...');

    // 1. services
    await pool.query(`
      CREATE TABLE IF NOT EXISTS services (
        id VARCHAR(50) PRIMARY KEY,
        name VARCHAR(255) NOT NULL,
        durationMinutes INT NOT NULL,
        price DECIMAL(10,2) NOT NULL,
        description TEXT,
        isActive TINYINT(1) DEFAULT 1
      )
    `);

    // 2. staff
    await pool.query(`
      CREATE TABLE IF NOT EXISTS staff (
        id VARCHAR(50) PRIMARY KEY,
        name VARCHAR(255) NOT NULL,
        role VARCHAR(255),
        email VARCHAR(255),
        active TINYINT(1) DEFAULT 1
      )
    `);

    // 3. appointments
    await pool.query(`
      CREATE TABLE IF NOT EXISTS appointments (
        id VARCHAR(50) PRIMARY KEY,
        customerName VARCHAR(255) NOT NULL,
        customerEmail VARCHAR(255),
        customerPhone VARCHAR(50),
        date VARCHAR(50) NOT NULL,
        timeSlot VARCHAR(20) NOT NULL,
        serviceId VARCHAR(50),
        staffId VARCHAR(50),
        status VARCHAR(50) DEFAULT 'confirmed',
        notes TEXT,
        createdAt VARCHAR(100),
        reminderSent TINYINT(1) DEFAULT 0,
        reminderTemplateId VARCHAR(50)
      )
    `);

    // 4. availability
    await pool.query(`
      CREATE TABLE IF NOT EXISTS availability (
        dayOfWeek INT PRIMARY KEY,
        isWorkingDay TINYINT(1) DEFAULT 1,
        startTime VARCHAR(15),
        endTime VARCHAR(15),
        breakTimeStart VARCHAR(15),
        breakTimeEnd VARCHAR(15)
      )
    `);

    // 5. custom_blocks
    await pool.query(`
      CREATE TABLE IF NOT EXISTS custom_blocks (
        id VARCHAR(50) PRIMARY KEY,
        date VARCHAR(50) NOT NULL,
        startTime VARCHAR(15),
        endTime VARCHAR(15),
        reason VARCHAR(255)
      )
    `);

    // 6. email_templates
    await pool.query(`
      CREATE TABLE IF NOT EXISTS email_templates (
        id VARCHAR(50) PRIMARY KEY,
        name VARCHAR(255) NOT NULL,
        type VARCHAR(50),
        subject VARCHAR(255),
        body TEXT
      )
    `);

    // 7. email_logs
    await pool.query(`
      CREATE TABLE IF NOT EXISTS email_logs (
        id VARCHAR(50) PRIMARY KEY,
        appointmentId VARCHAR(50),
        customerEmail VARCHAR(255),
        subject VARCHAR(255),
        body TEXT,
        sentAt VARCHAR(100),
        status VARCHAR(50)
      )
    `);

    // 8. settings
    await pool.query(`
      CREATE TABLE IF NOT EXISTS settings (
        id VARCHAR(50) PRIMARY KEY,
        businessName VARCHAR(255),
        currency VARCHAR(50),
        address VARCHAR(255),
        contactEmail VARCHAR(255),
        contactPhone VARCHAR(50)
      )
    `);

    // Seed tables if empty
    // Services
    const [currentServices] = await pool.query('SELECT COUNT(*) as cnt FROM services');
    if (currentServices[0].cnt === 0) {
      for (const s of INITIAL_STATE.services) {
        await pool.query(
          'INSERT INTO services (id, name, durationMinutes, price, description, isActive) VALUES (?, ?, ?, ?, ?, ?)',
          [s.id, s.name, s.durationMinutes, s.price, s.description || '', s.isActive ? 1 : 0]
        );
      }
    }

    // Staff
    const [currentStaff] = await pool.query('SELECT COUNT(*) as cnt FROM staff');
    if (currentStaff[0].cnt === 0) {
      for (const st of INITIAL_STATE.staff) {
        await pool.query(
          'INSERT INTO staff (id, name, role, email, active) VALUES (?, ?, ?, ?, ?)',
          [st.id, st.name, st.role || '', st.email || '', st.active ? 1 : 0]
        );
      }
    }

    // Availability
    const [currentAvail] = await pool.query('SELECT COUNT(*) as cnt FROM availability');
    if (currentAvail[0].cnt === 0) {
      for (const a of INITIAL_STATE.availability) {
        await pool.query(
          'INSERT INTO availability (dayOfWeek, isWorkingDay, startTime, endTime, breakTimeStart, breakTimeEnd) VALUES (?, ?, ?, ?, ?, ?)',
          [a.dayOfWeek, a.isWorkingDay ? 1 : 0, a.startTime, a.endTime, a.breakTimeStart || null, a.breakTimeEnd || null]
        );
      }
    }

    // Custom Blocks
    const [currentBlocks] = await pool.query('SELECT COUNT(*) as cnt FROM custom_blocks');
    if (currentBlocks[0].cnt === 0) {
      for (const b of INITIAL_STATE.customBlocks) {
        await pool.query(
          'INSERT INTO custom_blocks (id, date, startTime, endTime, reason) VALUES (?, ?, ?, ?, ?)',
          [b.id, b.date, b.startTime, b.endTime, b.reason || '']
        );
      }
    }

    // Email Templates
    const [currentTemplates] = await pool.query('SELECT COUNT(*) as cnt FROM email_templates');
    if (currentTemplates[0].cnt === 0) {
      for (const t of INITIAL_STATE.emailTemplates) {
        await pool.query(
          'INSERT INTO email_templates (id, name, type, subject, body) VALUES (?, ?, ?, ?, ?)',
          [t.id, t.name, t.type || '', t.subject || '', t.body || '']
        );
      }
    }

    // Settings
    const [currentSettings] = await pool.query('SELECT COUNT(*) as cnt FROM settings');
    if (currentSettings[0].cnt === 0) {
      const s = INITIAL_STATE.settings;
      await pool.query(
        'INSERT INTO settings (id, businessName, currency, address, contactEmail, contactPhone) VALUES (?, ?, ?, ?, ?, ?)',
        ['singleton', s.businessName, s.currency, s.address, s.contactEmail, s.contactPhone]
      );
    }

    // Appointments seeding
    const [currentAppts] = await pool.query('SELECT COUNT(*) as cnt FROM appointments');
    if (currentAppts[0].cnt === 0) {
      for (const a of INITIAL_STATE.appointments) {
        await pool.query(
          'INSERT INTO appointments (id, customerName, customerEmail, customerPhone, date, timeSlot, serviceId, staffId, status, notes, createdAt, reminderSent) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
          [a.id, a.customerName, a.customerEmail || null, a.customerPhone || null, a.date, a.timeSlot, a.serviceId, a.staffId || null, a.status, a.notes || '', a.createdAt, a.reminderSent ? 1 : 0]
        );
      }
    }

    console.log('MySQL setup completed successfully.');
    isMySqlActiveStatus = true;
    return true;
  } catch (err) {
    console.warn('MySQL initialization/migration failed. Falling back to local file store. Error:', err.message);
    isMySqlActiveStatus = false;
    return false;
  }
}

// Fire table initialization in background
ensureMySqlTables().catch(err => {
  console.error('Asynchronous initial MySQL setup error:', err);
});

export const db = {
  // Check if MySQL setup is active and responsive.
  async isMySqlActive() {
    if (!pool) return false;
    if (isMySqlActiveStatus === true) return true;
    return await ensureMySqlTables();
  },

  async getState() {
    const isMySql = await this.isMySqlActive();
    if (!isMySql) {
      return { ...localState, isMySqlConnected: false };
    }

    try {
      const [appointments] = await pool.query('SELECT * FROM appointments');
      const [services] = await pool.query('SELECT * FROM services');
      const [availability] = await pool.query('SELECT * FROM availability');
      const [customBlocks] = await pool.query('SELECT * FROM custom_blocks');
      const [emailTemplates] = await pool.query('SELECT * FROM email_templates');
      const [emailLogs] = await pool.query('SELECT * FROM email_logs');
      const [staff] = await pool.query('SELECT * FROM staff');
      const [settingsRows] = await pool.query('SELECT * FROM settings WHERE id = "singleton"');

      const mappedAppts = appointments.map(a => ({
        id: a.id,
        customerName: a.customerName,
        customerEmail: a.customerEmail || '',
        customerPhone: a.customerPhone || '',
        date: a.date,
        timeSlot: a.timeSlot,
        serviceId: a.serviceId,
        staffId: a.staffId || '',
        status: a.status,
        notes: a.notes || '',
        createdAt: a.createdAt,
        reminderSent: Boolean(a.reminderSent),
        reminderTemplateId: a.reminderTemplateId || ''
      }));

      const mappedServices = services.map(s => ({
        id: s.id,
        name: s.name,
        durationMinutes: s.durationMinutes,
        price: Number(s.price),
        description: s.description || '',
        isActive: Boolean(s.isActive)
      }));

      const mappedAvail = availability.map(av => ({
        dayOfWeek: av.dayOfWeek,
        isWorkingDay: Boolean(av.isWorkingDay),
        startTime: av.startTime,
        endTime: av.endTime,
        breakTimeStart: av.breakTimeStart || undefined,
        breakTimeEnd: av.breakTimeEnd || undefined
      }));

      const mappedBlocks = customBlocks.map(b => ({
        id: b.id,
        date: b.date,
        startTime: b.startTime,
        endTime: b.endTime,
        reason: b.reason || ''
      }));

      const mappedTemplates = emailTemplates.map(t => ({
        id: t.id,
        name: t.name,
        type: t.type,
        subject: t.subject,
        body: t.body
      }));

      const mappedLogs = emailLogs.map(l => ({
        id: l.id,
        appointmentId: l.appointmentId,
        customerEmail: l.customerEmail,
        subject: l.subject,
        body: l.body,
        sentAt: l.sentAt,
        status: l.status
      }));

      const mappedStaff = staff.map(st => ({
        id: st.id,
        name: st.name,
        role: st.role || '',
        email: st.email || '',
        active: Boolean(st.active)
      }));

      let mappedSettings = localState.settings;
      if (settingsRows && settingsRows.length > 0) {
        const s = settingsRows[0];
        mappedSettings = {
          businessName: s.businessName || INITIAL_STATE.settings.businessName,
          currency: s.currency || INITIAL_STATE.settings.currency,
          address: s.address || INITIAL_STATE.settings.address,
          contactEmail: s.contactEmail || INITIAL_STATE.settings.contactEmail,
          contactPhone: s.contactPhone || INITIAL_STATE.settings.contactPhone
        };
      }

      return {
        appointments: mappedAppts,
        services: mappedServices,
        availability: mappedAvail,
        customBlocks: mappedBlocks,
        emailTemplates: mappedTemplates,
        emailLogs: mappedLogs,
        staff: mappedStaff,
        settings: mappedSettings,
        isMySqlConnected: true
      };
    } catch (e) {
      console.error('MySQL query state failed. Using local storage.', e);
      return { ...localState, isMySqlConnected: false };
    }
  },

  async saveState(newState) {
    saveLocalDB(newState);
  },

  async getAppointments() {
    const state = await this.getState();
    return state.appointments;
  },

  async upsertAppointment(apt) {
    const state = { ...localState };
    const index = state.appointments.findIndex(a => a.id === apt.id);
    if (index >= 0) {
      state.appointments[index] = apt;
    } else {
      state.appointments.push(apt);
    }
    saveLocalDB(state);

    if (await this.isMySqlActive()) {
      try {
        await pool.query(`
          INSERT INTO appointments (id, customerName, customerEmail, customerPhone, date, timeSlot, serviceId, staffId, status, notes, createdAt, reminderSent, reminderTemplateId)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
          ON DUPLICATE KEY UPDATE 
            customerName = VALUES(customerName),
            customerEmail = VALUES(customerEmail),
            customerPhone = VALUES(customerPhone),
            date = VALUES(date),
            timeSlot = VALUES(timeSlot),
            serviceId = VALUES(serviceId),
            staffId = VALUES(staffId),
            status = VALUES(status),
            notes = VALUES(notes),
            createdAt = VALUES(createdAt),
            reminderSent = VALUES(reminderSent),
            reminderTemplateId = VALUES(reminderTemplateId)
        `, [
          apt.id,
          apt.customerName,
          apt.customerEmail || null,
          apt.customerPhone || null,
          apt.date,
          apt.timeSlot,
          apt.serviceId,
          apt.staffId || null,
          apt.status,
          apt.notes || '',
          apt.createdAt,
          apt.reminderSent ? 1 : 0,
          apt.reminderTemplateId || null
        ]);
      } catch (e) {
        console.error('MySQL appointment upsert error:', e);
      }
    }
    return apt;
  },

  async deleteAppointment(id) {
    const state = { ...localState };
    const originalLength = state.appointments.length;
    state.appointments = state.appointments.filter(a => a.id !== id);
    saveLocalDB(state);

    if (await this.isMySqlActive()) {
      try {
        await pool.query('DELETE FROM appointments WHERE id = ?', [id]);
      } catch (e) {
        console.error('MySQL appointment delete error:', e);
      }
    }
    return state.appointments.length < originalLength;
  },

  async getServices() {
    const state = await this.getState();
    return state.services;
  },

  async upsertService(service) {
    const state = { ...localState };
    const index = state.services.findIndex(s => s.id === service.id);
    if (index >= 0) {
      state.services[index] = service;
    } else {
      state.services.push(service);
    }
    saveLocalDB(state);

    if (await this.isMySqlActive()) {
      try {
        await pool.query(`
          INSERT INTO services (id, name, durationMinutes, price, description, isActive)
          VALUES (?, ?, ?, ?, ?, ?)
          ON DUPLICATE KEY UPDATE
            name = VALUES(name),
            durationMinutes = VALUES(durationMinutes),
            price = VALUES(price),
            description = VALUES(description),
            isActive = VALUES(isActive)
        `, [
          service.id,
          service.name,
          service.durationMinutes,
          service.price,
          service.description || '',
          service.isActive ? 1 : 0
        ]);
      } catch (e) {
        console.error('MySQL service upsert error:', e);
      }
    }
    return service;
  },

  async deleteService(id) {
    const state = { ...localState };
    state.services = state.services.filter(s => s.id !== id);
    saveLocalDB(state);

    if (await this.isMySqlActive()) {
      try {
        await pool.query('DELETE FROM services WHERE id = ?', [id]);
      } catch (e) {
        console.error('MySQL service delete error:', e);
      }
    }
    return true;
  },

  async getAvailability() {
    const state = await this.getState();
    return state.availability;
  },

  async updateAvailability(config) {
    const state = { ...localState };
    state.availability = config;
    saveLocalDB(state);

    if (await this.isMySqlActive()) {
      try {
        await pool.query('DELETE FROM availability');
        for (const c of config) {
          await pool.query(`
            INSERT INTO availability (dayOfWeek, isWorkingDay, startTime, endTime, breakTimeStart, breakTimeEnd)
            VALUES (?, ?, ?, ?, ?, ?)
          `, [
            c.dayOfWeek,
            c.isWorkingDay ? 1 : 0,
            c.startTime,
            c.endTime,
            c.breakTimeStart || null,
            c.breakTimeEnd || null
          ]);
        }
      } catch (e) {
        console.error('MySQL availability update error:', e);
      }
    }
    return config;
  },

  async getCustomBlocks() {
    const state = await this.getState();
    return state.customBlocks;
  },

  async saveCustomBlocks(blocks) {
    const state = { ...localState };
    state.customBlocks = blocks;
    saveLocalDB(state);

    if (await this.isMySqlActive()) {
      try {
        await pool.query('DELETE FROM custom_blocks');
        for (const b of blocks) {
          await pool.query(`
            INSERT INTO custom_blocks (id, date, startTime, endTime, reason)
            VALUES (?, ?, ?, ?, ?)
          `, [
            b.id,
            b.date,
            b.startTime,
            b.endTime,
            b.reason || ''
          ]);
        }
      } catch (e) {
        console.error('MySQL custom blocks save error:', e);
      }
    }
    return blocks;
  },

  async getEmailTemplates() {
    const state = await this.getState();
    return state.emailTemplates;
  },

  async upsertEmailTemplate(template) {
    const state = { ...localState };
    const index = state.emailTemplates.findIndex(t => t.id === template.id);
    if (index >= 0) {
      state.emailTemplates[index] = template;
    } else {
      state.emailTemplates.push(template);
    }
    saveLocalDB(state);

    if (await this.isMySqlActive()) {
      try {
        await pool.query(`
          INSERT INTO email_templates (id, name, type, subject, body)
          VALUES (?, ?, ?, ?, ?)
          ON DUPLICATE KEY UPDATE
            name = VALUES(name),
            type = VALUES(type),
            subject = VALUES(subject),
            body = VALUES(body)
        `, [
          template.id,
          template.name,
          template.type,
          template.subject,
          template.body
        ]);
      } catch (e) {
        console.error('MySQL template upsert error:', e);
      }
    }
    return template;
  },

  async logOutgoingEmail(log) {
    const state = { ...localState };
    state.emailLogs.unshift(log);
    saveLocalDB(state);

    if (await this.isMySqlActive()) {
      try {
        await pool.query(`
          INSERT INTO email_logs (id, appointmentId, customerEmail, subject, body, sentAt, status)
          VALUES (?, ?, ?, ?, ?, ?, ?)
        `, [
          log.id,
          log.appointmentId,
          log.customerEmail,
          log.subject,
          log.body,
          log.sentAt,
          log.status
        ]);
      } catch (e) {
        console.error('MySQL email log error:', e);
      }
    }
    return log;
  },

  async getEmailLogs() {
    const state = await this.getState();
    return state.emailLogs;
  },

  async getStaff() {
    const state = await this.getState();
    return state.staff || INITIAL_STATE.staff;
  },

  async upsertStaff(staffMember) {
    const state = { ...localState };
    if (!state.staff) state.staff = [...INITIAL_STATE.staff];
    const index = state.staff.findIndex(s => s.id === staffMember.id);
    if (index >= 0) {
      state.staff[index] = staffMember;
    } else {
      state.staff.push(staffMember);
    }
    saveLocalDB(state);

    if (await this.isMySqlActive()) {
      try {
        await pool.query(`
          INSERT INTO staff (id, name, role, email, active)
          VALUES (?, ?, ?, ?, ?)
          ON DUPLICATE KEY UPDATE
            name = VALUES(name),
            role = VALUES(role),
            email = VALUES(email),
            active = VALUES(active)
        `, [
          staffMember.id,
          staffMember.name,
          staffMember.role || '',
          staffMember.email || '',
          staffMember.active ? 1 : 0
        ]);
      } catch (e) {
        console.error('MySQL staff upsert error:', e);
      }
    }
    return staffMember;
  },

  async deleteStaff(id) {
    const state = { ...localState };
    if (!state.staff) state.staff = [...INITIAL_STATE.staff];
    state.staff = state.staff.filter(s => s.id !== id);
    saveLocalDB(state);

    if (await this.isMySqlActive()) {
      try {
        await pool.query('DELETE FROM staff WHERE id = ?', [id]);
      } catch (e) {
        console.error('MySQL staff delete error:', e);
      }
    }
    return true;
  },

  async getSettings() {
    const state = await this.getState();
    return state.settings || INITIAL_STATE.settings;
  },

  async saveSettings(settings) {
    const state = { ...localState };
    state.settings = { ...INITIAL_STATE.settings, ...state.settings, ...settings };
    saveLocalDB(state);

    if (await this.isMySqlActive()) {
      try {
        await pool.query(`
          INSERT INTO settings (id, businessName, currency, address, contactEmail, contactPhone)
          VALUES ('singleton', ?, ?, ?, ?, ?)
          ON DUPLICATE KEY UPDATE
            businessName = VALUES(businessName),
            currency = VALUES(currency),
            address = VALUES(address),
            contactEmail = VALUES(contactEmail),
            contactPhone = VALUES(contactPhone)
        `, [
          settings.businessName || INITIAL_STATE.settings.businessName,
          settings.currency || INITIAL_STATE.settings.currency,
          settings.address || INITIAL_STATE.settings.address,
          settings.contactEmail || INITIAL_STATE.settings.contactEmail,
          settings.contactPhone || INITIAL_STATE.settings.contactPhone
        ]);
      } catch (e) {
        console.error('MySQL settings save error:', e);
      }
    }
    return state.settings;
  }
};
