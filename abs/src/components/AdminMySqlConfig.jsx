import React, { useState, useEffect } from 'react';
import { Copy, Check, Server, Link, Database, Code, Info } from 'lucide-react';

export default function AdminMySqlConfig() {
  const [copied, setCopied] = useState(false);
  const [status, setStatus] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Fetch live status representing our database connection
    fetch('/api/status')
      .then(res => res.json())
      .then(data => {
        setStatus(data);
        setLoading(false);
      })
      .catch(err => {
        console.error('Error fetching database status:', err);
        setLoading(false);
      });
  }, []);

  const rawSQL = `-- 1. SERVICES CATALOG
CREATE TABLE IF NOT EXISTS services (
  id VARCHAR(50) PRIMARY KEY,
  name VARCHAR(255) NOT NULL,
  durationMinutes INT NOT NULL,
  price DECIMAL(10,2) NOT NULL,
  description TEXT,
  isActive TINYINT(1) DEFAULT 1
);

-- 2. STAFF DIRECTORY
CREATE TABLE IF NOT EXISTS staff (
  id VARCHAR(50) PRIMARY KEY,
  name VARCHAR(255) NOT NULL,
  role VARCHAR(255),
  email VARCHAR(255),
  active TINYINT(1) DEFAULT 1
);

-- 3. CLIENT APPOINTMENTS
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
);

-- 4. OPERATION HOURS
CREATE TABLE IF NOT EXISTS availability (
  dayOfWeek INT PRIMARY KEY,
  isWorkingDay TINYINT(1) DEFAULT 1,
  startTime VARCHAR(15),
  endTime VARCHAR(15),
  breakTimeStart VARCHAR(15),
  breakTimeEnd VARCHAR(15)
);

-- 5. BLOCKED DATES & CLOSURES
CREATE TABLE IF NOT EXISTS custom_blocks (
  id VARCHAR(50) PRIMARY KEY,
  date VARCHAR(50) NOT NULL,
  startTime VARCHAR(15),
  endTime VARCHAR(15),
  reason VARCHAR(255)
);

-- 6. NOTIFICATION TEMPLATES
CREATE TABLE IF NOT EXISTS email_templates (
  id VARCHAR(50) PRIMARY KEY,
  name VARCHAR(255) NOT NULL,
  type VARCHAR(50),
  subject VARCHAR(255),
  body TEXT
);

-- 7. SENT EMAIL LOGS
CREATE TABLE IF NOT EXISTS email_logs (
  id VARCHAR(50) PRIMARY KEY,
  appointmentId VARCHAR(50),
  customerEmail VARCHAR(255),
  subject VARCHAR(255),
  body TEXT,
  sentAt VARCHAR(100),
  status VARCHAR(50)
);

-- 8. BUSINESS PROFILE & CONFIGURATION
CREATE TABLE IF NOT EXISTS settings (
  id VARCHAR(50) PRIMARY KEY,
  businessName VARCHAR(255),
  currency VARCHAR(50),
  address VARCHAR(255),
  contactEmail VARCHAR(255),
  contactPhone VARCHAR(50)
);`;

  const copyToClipboard = () => {
    navigator.clipboard.writeText(rawSQL);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const isConnected = status?.isMySqlConnected;

  return (
    <div className="space-y-6 text-xs animate-fade-in">
      {/* Dynamic Connection Status Banner */}
      <div className="grid md:grid-cols-2 gap-4">
        {/* Connection Widget */}
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-5 space-y-4">
          <div className="flex items-center gap-2.5">
            <div className={`p-2.5 rounded-xl ${isConnected ? 'bg-emerald-50 text-emerald-600' : 'bg-secondary/40 text-primary'}`}>
              <Server className="w-5 h-5" />
            </div>
            <div>
              <h4 className="font-display font-bold text-slate-900 text-sm">MySQL Sync Status</h4>
              <p className="text-[10px] text-slate-400 mt-0.5">Real-time relational database persistence layer</p>
            </div>
          </div>

          <div className="p-4 bg-slate-50 rounded-xl border border-slate-150 space-y-2">
            <div className="flex justify-between items-center bg-white p-2 rounded-lg border border-slate-100">
              <span className="text-slate-550 font-bold block text-xs">Active Database Engine:</span>
              {loading ? (
                <span className="text-[10px] text-slate-400 animate-pulse font-bold">Querying...</span>
              ) : isConnected ? (
                <span className="font-bold text-emerald-700 flex items-center gap-1 bg-emerald-50 px-2.5 py-0.5 rounded-full text-[10px]">
                  <Database className="w-3 h-3 text-emerald-600" />
                  <span>MySQL Running (Cloud SQL)</span>
                </span>
              ) : (
                <span className="font-bold text-primary flex items-center gap-1 bg-secondary/35 px-2.5 py-0.5 rounded-full text-[10px]">
                  <Server className="w-3 h-3 text-primary" />
                  <span>File-Based Fallback (Active)</span>
                </span>
              )}
            </div>
            <p className="text-[10.5px] text-slate-500 leading-normal font-semibold">
              {isConnected 
                ? "Outstanding! The application is fully authenticated and synchronized directly to your live MySQL relational tables, supporting transactional scheduling procedures."
                : "The application is currently utilizing our high-speed, thread-safe JSON file database fallback. All booking actions, specialist registers, email reminders, and template updates operate seamlessly out-of-the-box."
              }
            </p>
          </div>
        </div>

        {/* Configuration Setup Guide */}
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-5 space-y-4">
          <h4 className="font-display font-bold text-slate-900 text-sm flex items-center gap-1.5">
            <Link className="w-4 h-4 text-blue-500" />
            <span>Connection Environment Parameters</span>
          </h4>
          <p className="text-slate-500 font-semibold leading-normal">To connect to your database, declare the environment variables inside the Secrets / Settings panel:</p>
          
          <div className="font-mono text-[10px] bg-slate-50 p-3 rounded-xl border border-slate-200 space-y-1.5 leading-tight">
            <div>
              <strong className="text-slate-800">MYSQL_HOST</strong>=<span className="text-blue-600">"your-database-endpoint.net"</span>
            </div>
            <div>
              <strong className="text-slate-800">MYSQL_USER</strong>=<span className="text-blue-600">"admin_user"</span>
            </div>
            <div>
              <strong className="text-slate-800">MYSQL_PASSWORD</strong>=<span className="text-blue-600">"your_secure_password"</span>
            </div>
            <div>
              <strong className="text-slate-805">MYSQL_DATABASE</strong>=<span className="text-blue-600">"your_database_name"</span>
            </div>
            <div>
              <strong className="text-slate-805">MYSQL_PORT</strong>=<span className="text-blue-600">"3306"</span>
            </div>
          </div>
        </div>
      </div>

      {/* SQL Migration Script Copy section */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-5 space-y-4">
        <div className="flex justify-between items-center border-b border-slate-150 pb-3 flex-wrap gap-2">
          <div className="space-y-0.5">
            <h4 className="font-sans font-bold text-slate-900 text-sm flex items-center gap-1.5">
              <Code className="w-4.5 h-4.5 text-blue-500" />
              <span>Full MySQL DDL Relational Schema</span>
            </h4>
            <p className="text-slate-500 font-semibold">Our Node.js server automatically runs these migrations during startup if MySQL is active or initialized, creating all necessary tables.</p>
          </div>
          <button
            onClick={copyToClipboard}
            className="flex items-center gap-1.5 p-2 px-3 bg-white border border-slate-250 hover:border-slate-400 hover:bg-slate-50 rounded-lg font-bold text-slate-700 transition cursor-pointer"
          >
            {copied ? (
              <>
                <Check className="w-3.5 h-3.5 text-emerald-600 font-bold" />
                <span className="text-emerald-700">Schema Copied!</span>
              </>
            ) : (
              <>
                <Copy className="w-3.5 h-3.5 text-slate-500" />
                <span>Copy Script</span>
              </>
            )}
          </button>
        </div>

        <div className="bg-slate-950 text-slate-300 rounded-xl p-4 font-mono text-[9.5px] overflow-x-auto max-h-[220px] leading-relaxed relative shadow-inner">
          <pre className="whitespace-pre">{rawSQL}</pre>
        </div>

        <div className="flex gap-2.5 items-start bg-secondary/25 text-primary p-4 rounded-xl text-[10.5px] leading-relaxed border border-secondary/40 font-semibold">
          <Info className="w-4 h-4 text-primary shrink-0 mt-0.5" />
          <p>
            Once credentials are set, the backend will auto-detect, create tables if absent, initialize sample entries, and run transactional read-and-write workflows natively with infinite scaling.
          </p>
        </div>
      </div>
    </div>
  );
}
