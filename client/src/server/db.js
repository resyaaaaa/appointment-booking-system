import fs from 'fs';
import path from 'path';
import mysql from 'mysql2/promise';
import dotenv from 'dotenv';


/* =========================
   LOCAL JSON DATABASE
========================= */

const DB_DIR = path.join(process.cwd(), 'data');
const DB_FILE = path.join(DB_DIR, 'appointment_db.json');

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
  customBlocks: [
    {
      id: 'block-1',
      date: new Date(Date.now() + 86400000 * 5).toISOString().split('T')[0], // 5 days from now
      reason: 'Staff training session',
      startTime: '09:00',
      endTime: '12:00',
    }
  ],
  emailTemplates: [
    {
      id: 'tpl-conf',
      name: 'Standard Booking Confirmation',
      type: 'confirmation',
      subject: 'Reservation Confirmed: {service_name} with {business_name}',
      body: 'Hello {customer_name},\n\nYour appointment is confirmed!\n\nService: {service_name}\nDate: {appointment_date}\nTime: {appointment_time}\n\nStaff Notes: {notes}\n\nWe look forward to giving you an exceptional experience. If you need to make corrections, reply to this email or call us directly!\n\nBest regards,\nThe Team at {business_name}'
    },
    {
      id: 'tpl-rem',
      name: 'Day-Before Appointment Reminder',
      type: 'reminder',
      subject: 'Reminder: Your upcoming reservation at {business_name} tomorrow',
      body: 'Hi {customer_name},\n\nWe are looking forward to seeing you tomorrow for your appointment!\n\nBusiness: {business_name}\nService: {service_name}\nDate: {appointment_date}\nTime: {appointment_time}\n\nLocation: 404 Design District, Suite 300\n\nIf you must reschedule, please give us a courtesy heads-up.\n\nWarmly,\n{business_name}'
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
    { id: 'st-1', name: 'Alex Rivera', role: 'Master Barber', email: 'alex@example.com', active: true },
    { id: 'st-2', name: 'Maria Santos', role: 'Color Specialist', email: 'maria@example.com', active: true },
    { id: 'st-3', name: 'Jordan Lee', role: 'Stylist Professional', email: 'jordan@example.com', active: true }
  ],
  settings: {
    businessName: 'My business Name',
    currency: 'RM',
    address: '404 Design District, Suite 300',
    contactEmail: 'name@example.com',
    contactPhone: '555-0100'
  },
  users: [
    {
      id: 'u-1',
      email: 'name@example.com',
      passwordHash: 'a665a45920422f9d417e4867efdc4fb8a04a1f3fff1fa07e998e86f7f7a27ae3', // '123' sha256 hashed
      name: 'Admin Owner',
      role: 'owner',
      phone: '555-0100',
      createdAt: '2026-06-15T00:00:00.000Z'
    }
  ]
};

function initializeLocalDB() {
  if (!fs.existsSync(DB_DIR)) {
    fs.mkdirSync(DB_DIR, { recursive: true });
  }

  if (!fs.existsSync(DB_FILE)) {
    fs.writeFileSync(DB_FILE, JSON.stringify(INITIAL_STATE, null, 2));
    return INITIAL_STATE;
  }

  try {
    const raw = fs.readFileSync(DB_FILE, 'utf8');
    const parsed = JSON.parse(raw);
    return {
      ...INITIAL_STATE,
      ...parsed,
      staff: parsed.staff || INITIAL_STATE.staff,
      settings: parsed.settings || INITIAL_STATE.settings,
      users: parsed.users || INITIAL_STATE.users
    };
  } catch {
    fs.writeFileSync(DB_FILE, JSON.stringify(INITIAL_STATE, null, 2));
    return INITIAL_STATE;
  }
}

let localState = initializeLocalDB();

function saveLocalDB(state) {
  localState = state;
  fs.writeFileSync(DB_FILE, JSON.stringify(state, null, 2));
}

/* =========================
   MYSQL SETUP
========================= */
let isMySqlActiveStatus = null;

let pool = null;
let mysqlReady = false;

function isMySqlConfigured() {
  return (
    process.env.MYSQL_HOST?.trim() &&
    process.env.MYSQL_USER?.trim() &&
    process.env.MYSQL_DATABASE?.trim()
  );
}

export function getPool() {
  if (!isMySqlConfigured()) return null;
  if (pool) return pool;

  pool = mysql.createPool({
    host: process.env.MYSQL_HOST,
    user: process.env.MYSQL_USER,
    password: process.env.MYSQL_PASSWORD ?? '',
    database: process.env.MYSQL_DATABASE,
    port: Number(process.env.MYSQL_PORT || 3306),
    waitForConnections: true,
    connectionLimit: 10
  });

  return pool;
}

/* =========================
   MYSQL INITIALIZATION
========================= */

async function ensureMySqlTables() {
  const db = getPool();
  if (!db) return false;

  if (mysqlReady) return true;

  try {
    const conn = await db.getConnection();
    await conn.ping();
    conn.release();

    // 1. Define ALL tables that you intend to seed
    const queries = [
      `CREATE TABLE IF NOT EXISTS services (
        id VARCHAR(100) PRIMARY KEY,
        name VARCHAR(255),
        durationMinutes INT,
        price DECIMAL(10,2),
        description TEXT,
        isActive TINYINT
      )`,

      `CREATE TABLE IF NOT EXISTS staff (
        id VARCHAR(100) PRIMARY KEY,
        name VARCHAR(255),
        role VARCHAR(255),
        email VARCHAR(255),
        active TINYINT
      )`,

      `CREATE TABLE IF NOT EXISTS appointments (
        id VARCHAR(100) PRIMARY KEY,
        customerName VARCHAR(255),
        customerEmail VARCHAR(255),
        customerPhone VARCHAR(100),
        date VARCHAR(100),
        timeSlot VARCHAR(100),
        serviceId VARCHAR(100),
        staffId VARCHAR(100),
        status VARCHAR(100),
        notes TEXT,
        createdAt VARCHAR(100),
        reminderSent TINYINT,
        reminderTemplateId VARCHAR(100)
      )`,

      `CREATE TABLE IF NOT EXISTS availability (
        dayOfWeek INT PRIMARY KEY,
        isWorkingDay TINYINT,
        startTime VARCHAR(50),
        endTime VARCHAR(50),
        breakTimeStart VARCHAR(50),
        breakTimeEnd VARCHAR(50)
      )`,

      `CREATE TABLE IF NOT EXISTS custom_blocks (
        id VARCHAR(100) PRIMARY KEY,
        date VARCHAR(100),
        startTime VARCHAR(50),
        endTime VARCHAR(50),
        reason TEXT
      )`,

      `CREATE TABLE IF NOT EXISTS email_templates (
        id VARCHAR(100) PRIMARY KEY,
        name VARCHAR(255),
        type VARCHAR(100),
        subject VARCHAR(255),
        body TEXT
      )`,

      `CREATE TABLE IF NOT EXISTS users (
        id VARCHAR(100) PRIMARY KEY,
        email VARCHAR(255),
        passwordHash VARCHAR(255),
        name VARCHAR(255),
        role VARCHAR(100),
        phone VARCHAR(100),
        createdAt VARCHAR(100)
      )`,

      `CREATE TABLE IF NOT EXISTS settings (
        id VARCHAR(100) PRIMARY KEY,
        businessName VARCHAR(255),
        currency VARCHAR(50),
        address TEXT,
        contactEmail VARCHAR(255),
        contactPhone VARCHAR(100)
      )`
    ];

    for (const q of queries) {
      await db.query(q);
    }

    // 2. Automatic Seeding for MySQL (Protected against race conditions)
    await seedMySqlTable(db, 'services', INITIAL_STATE.services, async (item) => {
      await db.query(
        'INSERT IGNORE INTO services (id, name, durationMinutes, price, description, isActive) VALUES (?, ?, ?, ?, ?, ?)',
        [item.id, item.name, item.durationMinutes, item.price, item.description, item.isActive ? 1 : 0]
      );
    });

    await seedMySqlTable(db, 'staff', INITIAL_STATE.staff, async (item) => {
      await db.query(
        'INSERT IGNORE INTO staff (id, name, role, email, active) VALUES (?, ?, ?, ?, ?)',
        [item.id, item.name, item.role, item.email, item.active ? 1 : 0]
      );
    });

    await seedMySqlTable(db, 'availability', INITIAL_STATE.availability, async (item) => {
      await db.query(
        'INSERT IGNORE INTO availability (dayOfWeek, isWorkingDay, startTime, endTime, breakTimeStart, breakTimeEnd) VALUES (?, ?, ?, ?, ?, ?)',
        [item.dayOfWeek, item.isWorkingDay ? 1 : 0, item.startTime, item.endTime, item.breakTimeStart || null, item.breakTimeEnd || null]
      );
    });

    await seedMySqlTable(db, 'custom_blocks', INITIAL_STATE.customBlocks, async (item) => {
      await db.query(
        'INSERT IGNORE INTO custom_blocks (id, date, startTime, endTime, reason) VALUES (?, ?, ?, ?, ?)',
        [item.id, item.date, item.startTime, item.endTime, item.reason]
      );
    });

    await seedMySqlTable(db, 'email_templates', INITIAL_STATE.emailTemplates, async (item) => {
      await db.query(
        'INSERT IGNORE INTO email_templates (id, name, type, subject, body) VALUES (?, ?, ?, ?, ?)',
        [item.id, item.name, item.type, item.subject, item.body]
      );
    });

    await seedMySqlTable(db, 'users', INITIAL_STATE.users, async (item) => {
      await db.query(
        'INSERT IGNORE INTO users (id, email, passwordHash, name, role, phone, createdAt) VALUES (?, ?, ?, ?, ?, ?, ?)',
        [item.id, item.email, item.passwordHash, item.name, item.role, item.phone || '', item.createdAt]
      );
    });


    const s = INITIAL_STATE.settings;
    await db.query(
      'INSERT IGNORE INTO settings (id, businessName, currency, address, contactEmail, contactPhone) VALUES (?, ?, ?, ?, ?, ?)',
      [1, s.businessName, s.currency, s.address, s.contactEmail, s.contactPhone]
    );

    console.log('MySQL schema verification and default seeds loaded.');
    mysqlReady = true;
    isMySqlActiveStatus = true;
    return true;
  } catch (err) {
    console.log('Using local JSON file-system storage (MySQL connection offline/bypassed). Details:', err.message);
    mysqlReady = false;
    isMySqlActiveStatus = false;
    return false;
  }
}

// Pass the db handler into the seed utility function to avoid global scoping issues
async function seedMySqlTable(db, table, initialData, insertFn) {
  try {
    const [rows] = await db.query(`SELECT COUNT(*) as count FROM ${table}`);
    const count = rows?.[0]?.count ?? 0;

    if (count === 0 && Array.isArray(initialData)) {
      for (const item of initialData) {
        await insertFn(item);
      }
    }
  } catch (err) {
    console.log(`Seeding failed for ${table}:`, err.message);
  }
}

// Background Self-Execution
(async () => {
  try {
    await ensureMySqlTables();
  } catch (err) {
    console.log('Background MySQL initialization failed:', err.message);
  }
})();

/* =========================
   HELPERS
========================= */

async function useMySql() {
  if (!mysqlReady) {
    await ensureMySqlTables();
  }
  return mysqlReady;
}


/* =========================
   EXPORT API
========================= */

export const db = {
  async isMySqlActive() {
    return useMySql();
  },

  async getState() {
    if (!(await useMySql())) {
      return { ...localState, isMySqlConnected: false };
    }

    try {
      const db = getPool();

      const [appointments] = await db.query('SELECT * FROM appointments');
      const [services] = await db.query('SELECT * FROM services');
      const [staff] = await db.query('SELECT * FROM staff');

      return {
        appointments,
        services,
        staff,
        settings,
        isMySqlConnected: true
      };
    } catch {
      return { ...localState, isMySqlConnected: false };
    }
  },

  async saveState(state) {
    saveLocalDB(state);
  },

  async getAppointments() {
    return (await this.getState()).appointments;
  },

  async upsertAppointment(apt) {
    const state = { ...localState };
    const i = state.appointments.findIndex(a => a.id === apt.id);

    if (i >= 0) state.appointments[i] = apt;
    else state.appointments.push(apt);
 
    saveLocalDB(state);

    if (await this.isMySqlActive()) {
      try {
        await pool.query(
          `INSERT INTO appointments (id, customerName, customerEmail, customerPhone, date, timeSlot, serviceId, staffId, status, notes, createdAt, reminderSent, reminderTemplateId) 
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
             reminderTemplateId = VALUES(reminderTemplateId)`,
          [
            apt.id,
            apt.customerName,
            apt.customerEmail || null,
            apt.customerPhone || null,
            apt.date,
            apt.timeSlot,
            apt.serviceId,
            apt.staffId || null,
            apt.status || 'scheduled',
            apt.notes || '',
            apt.createdAt || new Date().toISOString(),
            apt.reminderSent ? 1 : 0,
            apt.reminderTemplateId || null
          ]
        );
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
        await pool.query(
          `INSERT INTO services (id, name, durationMinutes, price, description, isActive) 
           VALUES (?, ?, ?, ?, ?, ?) 
           ON DUPLICATE KEY UPDATE 
             name = VALUES(name), 
             durationMinutes = VALUES(durationMinutes), 
             price = VALUES(price), 
             description = VALUES(description), 
             isActive = VALUES(isActive)`,
          [service.id, service.name, service.durationMinutes, service.price, service.description || '', service.isActive ? 1 : 0]
        );
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
          await pool.query(
            'INSERT INTO availability (dayOfWeek, isWorkingDay, startTime, endTime, breakTimeStart, breakTimeEnd) VALUES (?, ?, ?, ?, ?, ?)',
            [c.dayOfWeek, c.isWorkingDay ? 1 : 0, c.startTime, c.endTime, c.breakTimeStart || null, c.breakTimeEnd || null]
          );
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
          await pool.query(
            'INSERT INTO custom_blocks (id, date, startTime, endTime, reason) VALUES (?, ?, ?, ?, ?)',
            [b.id, b.date, b.startTime, b.endTime, b.reason || '']
          );
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
        await pool.query(
          `INSERT INTO email_templates (id, name, type, subject, body) 
           VALUES (?, ?, ?, ?, ?) 
           ON DUPLICATE KEY UPDATE 
             name = VALUES(name), 
             type = VALUES(type), 
             subject = VALUES(subject), 
             body = VALUES(body)`,
          [template.id, template.name, template.type, template.subject, template.body]
        );
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
        await pool.query(
          'INSERT INTO email_logs (id, appointmentId, customerEmail, subject, body, sentAt, status) VALUES (?, ?, ?, ?, ?, ?, ?)',
          [log.id, log.appointmentId, log.customerEmail, log.subject, log.body, log.sentAt, log.status]
        );
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
        await pool.query(
          `INSERT INTO staff (id, name, role, email, active) 
           VALUES (?, ?, ?, ?, ?) 
           ON DUPLICATE KEY UPDATE 
             name = VALUES(name), 
             role = VALUES(role), 
             email = VALUES(email), 
             active = VALUES(active)`,
          [staffMember.id, staffMember.name, staffMember.role || '', staffMember.email || '', staffMember.active ? 1 : 0]
        );
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
        await pool.query(
          `INSERT INTO settings (id, businessName, currency, address, contactEmail, contactPhone) 
           VALUES (?, ?, ?, ?, ?, ?) 
           ON DUPLICATE KEY UPDATE 
             businessName = VALUES(businessName), 
             currency = VALUES(currency), 
             address = VALUES(address), 
             contactEmail = VALUES(contactEmail), 
             contactPhone = VALUES(contactPhone)`,
          [1, state.settings.businessName, state.settings.currency, state.settings.address, state.settings.contactEmail, state.settings.contactPhone]
        );
      } catch (e) {
        console.error('MySQL settings save error:', e);
      }
    }
    return state.settings;
  },

  async getUserByEmail(email) {
    const isMySql = await this.isMySqlActive();
    if (isMySql) {
      try {
        const [rows] = await pool.query('SELECT * FROM users WHERE LOWER(email) = LOWER(?)', [email]);
        if (rows && rows.length > 0) {
          return rows[0];
        }
        return null;
      } catch (e) {
        console.error('MySQL getUserByEmail error:', e);
      }
    }
    const state = { ...localState };
    if (!state.users) state.users = INITIAL_STATE.users;
    return state.users.find(u => u.email.toLowerCase() === email.toLowerCase()) || null;
  },

  async createUser(user) {
    const state = { ...localState };
    if (!state.users) state.users = INITIAL_STATE.users;
    state.users.push(user);
    saveLocalDB(state);

    const isMySql = await this.isMySqlActive();
    if (isMySql) {
      try {
        await pool.query(
          'INSERT INTO users (id, email, passwordHash, name, role, phone, createdAt) VALUES (?, ?, ?, ?, ?, ?, ?)',
          [user.id, user.email, user.passwordHash, user.name, user.role, user.phone || '', user.createdAt]
        );
      } catch (e) {
        console.error('MySQL createUser error:', e);
      }
    }
    return user;
  },

  async updateUser(user) {
    const state = { ...localState };
    if (!state.users) state.users = INITIAL_STATE.users;
    const index = state.users.findIndex(u => u.id === user.id);
    if (index >= 0) {
      state.users[index] = { ...state.users[index], ...user };
    }
    saveLocalDB(state);

    const isMySql = await this.isMySqlActive();
    if (isMySql) {
      try {
        await pool.query(
          `INSERT INTO users (id, email, passwordHash, name, role, phone, createdAt) 
           VALUES (?, ?, ?, ?, ?, ?, ?) 
           ON DUPLICATE KEY UPDATE 
             email = VALUES(email), 
             passwordHash = VALUES(passwordHash), 
             name = VALUES(name), 
             role = VALUES(role), 
             phone = VALUES(phone), 
             createdAt = VALUES(createdAt)`,
          [user.id, user.email, user.passwordHash, user.name, user.role, user.phone || '', user.createdAt]
        );
      } catch (e) {
        console.error('MySQL updateUser error:', e);
      }
    }
    return user;
  }
};
