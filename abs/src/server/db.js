import fs from 'fs';
import path from 'path';
import { MongoClient } from 'mongodb';
import crypto from 'crypto';

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
    if (!merged.users) merged.users = INITIAL_STATE.users;
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

// --- MongoDB Setup and Integration ---
let client = null;
let dbInstance = null;
let isMongoActiveStatus = null; // null = uninitialized, false = failed, true = active
let isMongoConfigured = false;

const mongoUri = process.env.MONGODB_URI || '';
const mongoDatabase = process.env.MONGODB_DATABASE || 'glamour_scheduling';

if (mongoUri) {
  isMongoConfigured = true;
}

async function ensureMongoCollections() {
  if (!mongoUri) {
    isMongoActiveStatus = false;
    return false;
  }
  if (isMongoActiveStatus === true) return true;
  if (isMongoActiveStatus === false) return false;

  try {
    console.log('Connecting to MongoDB database...');
    client = new MongoClient(mongoUri, {
      connectTimeoutMS: 5000,
      serverSelectionTimeoutMS: 5000
    });
    await client.connect();
    dbInstance = client.db(mongoDatabase);
    console.log('MongoDB connection pool instantiated.');

    // Seed collections if they are empty
    await seedMongoCollection('services', INITIAL_STATE.services);
    await seedMongoCollection('staff', INITIAL_STATE.staff);
    await seedMongoCollection('availability', INITIAL_STATE.availability);
    await seedMongoCollection('custom_blocks', INITIAL_STATE.customBlocks);
    await seedMongoCollection('email_templates', INITIAL_STATE.emailTemplates);
    await seedMongoCollection('email_logs', INITIAL_STATE.emailLogs);
    await seedMongoCollection('appointments', INITIAL_STATE.appointments);
    await seedMongoCollection('users', INITIAL_STATE.users);

    const settingsColl = dbInstance.collection('settings');
    const settingsCount = await settingsColl.countDocuments();
    if (settingsCount === 0) {
      await settingsColl.insertOne({ _id: 'singleton', ...INITIAL_STATE.settings });
    }

    console.log('MongoDB database schema verification and seed complete.');
    isMongoActiveStatus = true;
    return true;
  } catch (err) {
    const isSslAlert80 = err.message && (
      err.message.includes('alert number 80') || 
      err.message.includes('ssl3_read_bytes') || 
      err.message.includes('tlsv1 alert')
    );
    const diagMsg = isSslAlert80
      ? 'MongoDB Atlas TLS handshake failed (SSL alert number 80). This typically indicates that your MongoDB Atlas IP Whitelist / IP Access List database rules are blocking connections from the Cloud Run container runtime. To resolve: Go to MongoDB Atlas -> Security -> Network Access -> Add IP Address, and authorize either 0.0.0.0/0 (Recommended for easy setup) or your specific container IP range.'
      : `NoSQL Database connection could not be established. Details: ${err.message}`;
    
    console.log('[Notice] MongoDB connection bypassed. Using local JSON file-system storage fallback.');
    console.log('[Notice] DB Connection Diagnostic:', diagMsg);
    isMongoActiveStatus = false;
    return false;
  }
}

async function seedMongoCollection(colName, initialData) {
  const coll = dbInstance.collection(colName);
  const count = await coll.countDocuments();
  if (count === 0 && initialData && initialData.length > 0) {
    const docs = initialData.map(item => {
      const doc = { ...item };
      if (item.id) {
        doc._id = item.id;
      } else if (item.dayOfWeek !== undefined) {
        doc._id = `day-${item.dayOfWeek}`;
      }
      return doc;
    });
    try {
      await coll.insertMany(docs);
    } catch (e) {
      console.warn(`Seeding collection ${colName} failed:`, e.message);
    }
  }
}

// Fire table initialization in background
ensureMongoCollections().catch(err => {
  console.log('Background MongoDB initialization query bypassed.');
});

export const db = {
  // Check if MongoDB setup is active and responsive.
  async isMongoActive() {
    if (!mongoUri) return false;
    if (isMongoActiveStatus === true) return true;
    if (isMongoActiveStatus === false) return false;
    return await ensureMongoCollections();
  },

  // Maintain compatibility with existing interfaces
  async isMySqlActive() {
    return await this.isMongoActive();
  },

  async getState() {
    const isMongo = await this.isMongoActive();
    if (!isMongo) {
      const safeUsers = (localState.users || []).map(u => ({
        id: u.id,
        email: u.email,
        name: u.name,
        role: u.role,
        phone: u.phone || '',
        createdAt: u.createdAt
      }));
      return { ...localState, users: safeUsers, isMySqlConnected: false, isMongoConnected: false };
    }

    try {
      const appointments = await dbInstance.collection('appointments').find({}).toArray();
      const services = await dbInstance.collection('services').find({}).toArray();
      const availability = await dbInstance.collection('availability').find({}).toArray();
      const customBlocks = await dbInstance.collection('custom_blocks').find({}).toArray();
      const emailTemplates = await dbInstance.collection('email_templates').find({}).toArray();
      const emailLogs = await dbInstance.collection('email_logs').find({}).toArray();
      const staff = await dbInstance.collection('staff').find({}).toArray();
      const users = await dbInstance.collection('users').find({}).toArray();
      const settingsRows = await dbInstance.collection('settings').find({ _id: 'singleton' }).toArray();

      const mappedAppts = appointments.map(a => ({
        id: a.id || a._id,
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
        id: s.id || s._id,
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
        id: b.id || b._id,
        date: b.date,
        startTime: b.startTime,
        endTime: b.endTime,
        reason: b.reason || ''
      }));

      const mappedTemplates = emailTemplates.map(t => ({
        id: t.id || t._id,
        name: t.name,
        type: t.type,
        subject: t.subject,
        body: t.body
      }));

      const mappedLogs = emailLogs.map(l => ({
        id: l.id || l._id,
        appointmentId: l.appointmentId,
        customerEmail: l.customerEmail,
        subject: l.subject,
        body: l.body,
        sentAt: l.sentAt,
        status: l.status
      })).sort((a,b) => b.sentAt.localeCompare(a.sentAt));

      const mappedStaff = staff.map(st => ({
        id: st.id || st._id,
        name: st.name,
        role: st.role || '',
        email: st.email || '',
        active: Boolean(st.active)
      }));

      const mappedUsers = users.map(u => ({
        id: u.id || u._id,
        email: u.email,
        name: u.name,
        role: u.role,
        phone: u.phone || '',
        createdAt: u.createdAt
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
        users: mappedUsers,
        isMySqlConnected: true,
        isMongoConnected: true
      };
    } catch (e) {
      console.error('MongoDB query state failed. Using local storage.', e);
      return { ...localState, isMySqlConnected: false, isMongoConnected: false };
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

    if (await this.isMongoActive()) {
      try {
        await dbInstance.collection('appointments').replaceOne(
          { _id: apt.id },
          { _id: apt.id, ...apt },
          { upsert: true }
        );
      } catch (e) {
        console.error('MongoDB appointment upsert error:', e);
      }
    }
    return apt;
  },

  async deleteAppointment(id) {
    const state = { ...localState };
    const originalLength = state.appointments.length;
    state.appointments = state.appointments.filter(a => a.id !== id);
    saveLocalDB(state);

    if (await this.isMongoActive()) {
      try {
        await dbInstance.collection('appointments').deleteOne({ _id: id });
      } catch (e) {
        console.error('MongoDB appointment delete error:', e);
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

    if (await this.isMongoActive()) {
      try {
        await dbInstance.collection('services').replaceOne(
          { _id: service.id },
          { _id: service.id, ...service },
          { upsert: true }
        );
      } catch (e) {
        console.error('MongoDB service upsert error:', e);
      }
    }
    return service;
  },

  async deleteService(id) {
    const state = { ...localState };
    state.services = state.services.filter(s => s.id !== id);
    saveLocalDB(state);

    if (await this.isMongoActive()) {
      try {
        await dbInstance.collection('services').deleteOne({ _id: id });
      } catch (e) {
        console.error('MongoDB service delete error:', e);
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

    if (await this.isMongoActive()) {
      try {
        const coll = dbInstance.collection('availability');
        await coll.deleteMany({});
        if (config.length > 0) {
          const docs = config.map(c => ({ _id: `day-${c.dayOfWeek}`, ...c }));
          await coll.insertMany(docs);
        }
      } catch (e) {
        console.error('MongoDB availability update error:', e);
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

    if (await this.isMongoActive()) {
      try {
        const coll = dbInstance.collection('custom_blocks');
        await coll.deleteMany({});
        if (blocks.length > 0) {
          const docs = blocks.map(b => ({ _id: b.id, ...b }));
          await coll.insertMany(docs);
        }
      } catch (e) {
        console.error('MongoDB custom blocks save error:', e);
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

    if (await this.isMongoActive()) {
      try {
        await dbInstance.collection('email_templates').replaceOne(
          { _id: template.id },
          { _id: template.id, ...template },
          { upsert: true }
        );
      } catch (e) {
        console.error('MongoDB template upsert error:', e);
      }
    }
    return template;
  },

  async logOutgoingEmail(log) {
    const state = { ...localState };
    state.emailLogs.unshift(log);
    saveLocalDB(state);

    if (await this.isMongoActive()) {
      try {
        await dbInstance.collection('email_logs').insertOne({ _id: log.id, ...log });
      } catch (e) {
        console.error('MongoDB email log error:', e);
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

    if (await this.isMongoActive()) {
      try {
        await dbInstance.collection('staff').replaceOne(
          { _id: staffMember.id },
          { _id: staffMember.id, ...staffMember },
          { upsert: true }
        );
      } catch (e) {
        console.error('MongoDB staff upsert error:', e);
      }
    }
    return staffMember;
  },

  async deleteStaff(id) {
    const state = { ...localState };
    if (!state.staff) state.staff = [...INITIAL_STATE.staff];
    state.staff = state.staff.filter(s => s.id !== id);
    saveLocalDB(state);

    if (await this.isMongoActive()) {
      try {
        await dbInstance.collection('staff').deleteOne({ _id: id });
      } catch (e) {
        console.error('MongoDB staff delete error:', e);
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

    if (await this.isMongoActive()) {
      try {
        await dbInstance.collection('settings').replaceOne(
          { _id: 'singleton' },
          { _id: 'singleton', ...state.settings },
          { upsert: true }
        );
      } catch (e) {
        console.error('MongoDB settings save error:', e);
      }
    }
    return state.settings;
  },

  async getUserByEmail(email) {
    const isMongo = await this.isMongoActive();
    if (isMongo) {
      try {
        const u = await dbInstance.collection('users').findOne({ email: new RegExp(`^${email}$`, 'i') });
        if (u) {
          return { ...u, id: u.id || u._id };
        }
        return null;
      } catch (e) {
        console.error('MongoDB getUserByEmail error:', e);
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

    const isMongo = await this.isMongoActive();
    if (isMongo) {
      try {
        await dbInstance.collection('users').insertOne({ _id: user.id, ...user });
      } catch (e) {
        console.error('MongoDB createUser error:', e);
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

    const isMongo = await this.isMongoActive();
    if (isMongo) {
      try {
        await dbInstance.collection('users').replaceOne(
          { _id: user.id },
          { _id: user.id, ...user },
          { upsert: true }
        );
      } catch (e) {
        console.error('MongoDB updateUser error:', e);
      }
    }
    return user;
  }
};
