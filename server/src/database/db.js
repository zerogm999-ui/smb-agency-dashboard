// PostgreSQL Database Setup & Schema
const pgp = require('pg-promise')();

// Connection configuration
const connectionConfig = {
  host: process.env.DB_HOST || 'localhost',
  port: parseInt(process.env.DB_PORT) || 5432,
  database: process.env.DB_NAME || 'smb_dashboard',
  user: process.env.DB_USER || 'postgres',
  password: process.env.DB_PASSWORD || 'postgres',
  max: 20,           // Max pool size
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 5000,
};

// Use DATABASE_URL if provided (for production/Docker)
const db = process.env.DATABASE_URL
  ? pgp({ connectionString: process.env.DATABASE_URL, ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false })
  : pgp(connectionConfig);

// ---------------------
// Schema Definition
// ---------------------
const schema = `
  -- Enable UUID extension
  CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

  -- Agencies (tenants)
  CREATE TABLE IF NOT EXISTS agencies (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(255) NOT NULL,
    email VARCHAR(255) UNIQUE NOT NULL,
    phone VARCHAR(50),
    website VARCHAR(255),
    industry VARCHAR(100),
    plan VARCHAR(50) DEFAULT 'basic',
    status VARCHAR(20) DEFAULT 'active',
    monthly_budget DECIMAL(12,2) DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
  );

  -- Users (team members per agency)
  CREATE TABLE IF NOT EXISTS users (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    agency_id UUID NOT NULL REFERENCES agencies(id) ON DELETE CASCADE,
    email VARCHAR(255) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    name VARCHAR(255),
    role VARCHAR(20) DEFAULT 'user' CHECK (role IN ('admin', 'user', 'viewer')),
    status VARCHAR(20) DEFAULT 'active',
    last_login TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
  );

  -- Integrations (OAuth tokens for platforms)
  CREATE TABLE IF NOT EXISTS integrations (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    agency_id UUID NOT NULL REFERENCES agencies(id) ON DELETE CASCADE,
    platform VARCHAR(50) NOT NULL CHECK (platform IN ('google-ads', 'meta-ads', 'stripe', 'hubspot')),
    status VARCHAR(20) DEFAULT 'disconnected' CHECK (status IN ('connected', 'disconnected', 'error', 'expired')),
    access_token TEXT,
    refresh_token TEXT,
    token_expires_at TIMESTAMP WITH TIME ZONE,
    account_id VARCHAR(255),
    account_name VARCHAR(255),
    scopes TEXT,
    metadata JSONB DEFAULT '{}',
    last_sync_at TIMESTAMP WITH TIME ZONE,
    error_message TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(agency_id, platform)
  );

  -- Campaigns (metadata from platforms)
  CREATE TABLE IF NOT EXISTS campaigns (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    agency_id UUID NOT NULL REFERENCES agencies(id) ON DELETE CASCADE,
    integration_id UUID REFERENCES integrations(id) ON DELETE SET NULL,
    platform VARCHAR(50) NOT NULL,
    platform_campaign_id VARCHAR(255),
    name VARCHAR(255) NOT NULL,
    status VARCHAR(50) DEFAULT 'active',
    objective VARCHAR(100),
    budget_daily DECIMAL(12,2) DEFAULT 0,
    budget_total DECIMAL(12,2) DEFAULT 0,
    target_cpa DECIMAL(12,2),
    target_roas DECIMAL(8,2),
    currency VARCHAR(10) DEFAULT 'USD',
    start_date DATE,
    end_date DATE,
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
  );

  -- Daily Metrics (time series data)
  CREATE TABLE IF NOT EXISTS daily_metrics (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    agency_id UUID NOT NULL REFERENCES agencies(id) ON DELETE CASCADE,
    campaign_id UUID REFERENCES campaigns(id) ON DELETE CASCADE,
    platform VARCHAR(50) NOT NULL,
    date DATE NOT NULL,
    impressions INTEGER DEFAULT 0,
    clicks INTEGER DEFAULT 0,
    conversions INTEGER DEFAULT 0,
    spend DECIMAL(12,2) DEFAULT 0,
    revenue DECIMAL(12,2) DEFAULT 0,
    ctr DECIMAL(8,4) DEFAULT 0,
    cpc DECIMAL(8,4) DEFAULT 0,
    cpa DECIMAL(8,4) DEFAULT 0,
    roas DECIMAL(8,4) DEFAULT 0,
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
  );

  -- Sync History (track when data was synced)
  CREATE TABLE IF NOT EXISTS sync_history (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    agency_id UUID NOT NULL REFERENCES agencies(id) ON DELETE CASCADE,
    integration_id UUID REFERENCES integrations(id) ON DELETE SET NULL,
    platform VARCHAR(50) NOT NULL,
    status VARCHAR(20) DEFAULT 'pending' CHECK (status IN ('pending', 'running', 'completed', 'failed')),
    records_synced INTEGER DEFAULT 0,
    error_message TEXT,
    started_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    completed_at TIMESTAMP WITH TIME ZONE,
    duration_ms INTEGER,
    metadata JSONB DEFAULT '{}'
  );

  -- Reports (generated PDFs)
  CREATE TABLE IF NOT EXISTS reports (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    agency_id UUID NOT NULL REFERENCES agencies(id) ON DELETE CASCADE,
    title VARCHAR(255) NOT NULL,
    type VARCHAR(50) DEFAULT 'performance',
    status VARCHAR(20) DEFAULT 'generating' CHECK (status IN ('generating', 'completed', 'failed')),
    file_path TEXT,
    file_size INTEGER,
    date_range_start DATE,
    date_range_end DATE,
    platforms TEXT[] DEFAULT '{}',
    metadata JSONB DEFAULT '{}',
    created_by UUID REFERENCES users(id),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
  );

  -- Alerts (system notifications)
  CREATE TABLE IF NOT EXISTS alerts (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    agency_id UUID NOT NULL REFERENCES agencies(id) ON DELETE CASCADE,
    type VARCHAR(50) NOT NULL CHECK (type IN ('sync_failure', 'performance', 'budget', 'integration', 'system')),
    severity VARCHAR(20) DEFAULT 'info' CHECK (severity IN ('info', 'warning', 'error', 'critical')),
    title VARCHAR(255) NOT NULL,
    message TEXT,
    is_read BOOLEAN DEFAULT false,
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
  );

  -- Scheduled Jobs (background tasks)
  CREATE TABLE IF NOT EXISTS scheduled_jobs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(100) NOT NULL,
    type VARCHAR(50) NOT NULL,
    schedule VARCHAR(100),
    status VARCHAR(20) DEFAULT 'active' CHECK (status IN ('active', 'paused', 'completed', 'failed')),
    last_run_at TIMESTAMP WITH TIME ZONE,
    next_run_at TIMESTAMP WITH TIME ZONE,
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
  );

  -- CRM Leads (Lead to Revenue Funnel)
  CREATE TABLE IF NOT EXISTS leads (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    agency_id UUID NOT NULL REFERENCES agencies(id) ON DELETE CASCADE,
    campaign_id UUID REFERENCES campaigns(id) ON DELETE SET NULL,
    first_name VARCHAR(100),
    last_name VARCHAR(100),
    email VARCHAR(255),
    company VARCHAR(255),
    status VARCHAR(50) DEFAULT 'new' CHECK (status IN ('new', 'mql', 'sql', 'deal', 'closed_won', 'closed_lost')),
    value DECIMAL(12,2) DEFAULT 0,
    source VARCHAR(100),
    platform VARCHAR(50),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
  );

  -- Audit Logs (activity tracking)
  CREATE TABLE IF NOT EXISTS audit_logs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    agency_id UUID REFERENCES agencies(id) ON DELETE CASCADE,
    user_id UUID REFERENCES users(id) ON DELETE SET NULL,
    action VARCHAR(100) NOT NULL,
    resource_type VARCHAR(50),
    resource_id UUID,
    details JSONB DEFAULT '{}',
    ip_address VARCHAR(45),
    user_agent TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
  );

  -- ---------------------
  -- Indexes
  -- ---------------------
  CREATE INDEX IF NOT EXISTS idx_users_agency ON users(agency_id);
  CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
  CREATE INDEX IF NOT EXISTS idx_integrations_agency ON integrations(agency_id);
  CREATE INDEX IF NOT EXISTS idx_integrations_platform ON integrations(agency_id, platform);
  CREATE INDEX IF NOT EXISTS idx_campaigns_agency ON campaigns(agency_id);
  CREATE INDEX IF NOT EXISTS idx_campaigns_platform ON campaigns(agency_id, platform);
  CREATE INDEX IF NOT EXISTS idx_daily_metrics_agency ON daily_metrics(agency_id);
  CREATE INDEX IF NOT EXISTS idx_daily_metrics_date ON daily_metrics(agency_id, date);
  CREATE INDEX IF NOT EXISTS idx_daily_metrics_campaign ON daily_metrics(campaign_id, date);
  CREATE INDEX IF NOT EXISTS idx_leads_agency ON leads(agency_id);
  CREATE INDEX IF NOT EXISTS idx_leads_status ON leads(agency_id, status);
  CREATE INDEX IF NOT EXISTS idx_sync_history_agency ON sync_history(agency_id);
  CREATE INDEX IF NOT EXISTS idx_reports_agency ON reports(agency_id);
  CREATE INDEX IF NOT EXISTS idx_alerts_agency ON alerts(agency_id);
  CREATE INDEX IF NOT EXISTS idx_audit_logs_agency ON audit_logs(agency_id);
`;

// ---------------------
// Initialize Database
// ---------------------
async function initializeDatabase() {
  try {
    // Test connection
    const conn = await db.connect();
    console.log(`📦 Connected to PostgreSQL at ${conn.client.host}:${conn.client.port}`);
    conn.done();

    // Create schema
    await db.none(schema);
    console.log('📋 Database schema initialized (11 tables)');

    return true;
  } catch (error) {
    console.error('❌ Database initialization failed:', error.message);
    throw error;
  }
}

// ---------------------
// Helper: AppError Class
// ---------------------
class AppError extends Error {
  constructor(message, statusCode = 500, code = 'INTERNAL_ERROR') {
    super(message);
    this.statusCode = statusCode;
    this.code = code;
    this.isOperational = true;
  }
}

// ---------------------
// Helper: Async Handler
// ---------------------
function asyncHandler(fn) {
  return (req, res, next) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
}

module.exports = {
  db,
  initializeDatabase,
  AppError,
  asyncHandler,
};
