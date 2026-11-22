-- ProjectPulse Supabase Schema
-- Run this in the Supabase SQL Editor to set up your database

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Users table (extends Supabase Auth)
CREATE TABLE users (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  auth_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  role TEXT NOT NULL CHECK (role IN ('admin','field_inspector','contractor','citizen')),
  email TEXT NOT NULL,
  ward INTEGER,
  avatar TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Departments
CREATE TABLE departments (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL,
  head TEXT,
  contact_email TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Contractors
CREATE TABLE contractors (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL,
  registration_number TEXT,
  contact_person TEXT,
  contact_email TEXT,
  rating DECIMAL(3,2) DEFAULT 0,
  active_projects INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Projects
CREATE TABLE projects (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  category TEXT NOT NULL CHECK (category IN ('transit','bridges','water','parks','public_facilities')),
  ward INTEGER NOT NULL,
  department_id UUID REFERENCES departments(id),
  department TEXT,
  contractor_id UUID REFERENCES contractors(id),
  contractor TEXT,
  status TEXT NOT NULL CHECK (status IN ('on_track','under_review','critical','completed')) DEFAULT 'on_track',
  budget DECIMAL(15,2) NOT NULL DEFAULT 0,
  disbursed DECIMAL(15,2) NOT NULL DEFAULT 0,
  actual_progress INTEGER DEFAULT 0 CHECK (actual_progress BETWEEN 0 AND 100),
  planned_progress INTEGER DEFAULT 0 CHECK (planned_progress BETWEEN 0 AND 100),
  schedule_variance INTEGER GENERATED ALWAYS AS (actual_progress - planned_progress) STORED,
  start_date DATE,
  deadline DATE,
  estimated_completion DATE,
  lat DECIMAL(10,7),
  lng DECIMAL(10,7),
  location TEXT,
  description TEXT,
  tags TEXT[],
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Project Milestones
CREATE TABLE project_milestones (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  project_id TEXT REFERENCES projects(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  target_date DATE,
  completed BOOLEAN DEFAULT FALSE,
  completed_date DATE,
  order_index INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Progress Updates
CREATE TABLE progress_updates (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  project_id TEXT REFERENCES projects(id) ON DELETE CASCADE,
  actual_progress INTEGER NOT NULL,
  planned_progress INTEGER NOT NULL,
  update_month TEXT NOT NULL,
  submitted_by UUID REFERENCES users(id),
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Budget Transactions
CREATE TABLE budget_transactions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  project_id TEXT REFERENCES projects(id) ON DELETE CASCADE,
  amount DECIMAL(15,2) NOT NULL,
  transaction_type TEXT CHECK (transaction_type IN ('disbursement','return','adjustment')),
  description TEXT,
  authorized_by UUID REFERENCES users(id),
  transaction_date DATE DEFAULT CURRENT_DATE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Inspections
CREATE TABLE inspections (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  project_id TEXT REFERENCES projects(id) ON DELETE CASCADE,
  inspector_id UUID REFERENCES users(id),
  inspector_name TEXT,
  inspection_type TEXT NOT NULL,
  result TEXT CHECK (result IN ('Pass','Needs Attention','Fail')),
  notes TEXT,
  inspection_date DATE DEFAULT CURRENT_DATE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Citizen Reports
CREATE TABLE citizen_reports (
  id TEXT PRIMARY KEY,
  title TEXT NOT NULL,
  category TEXT NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('critical','under_review','assigned','resolved')) DEFAULT 'under_review',
  priority TEXT CHECK (priority IN ('low','medium','high','critical')) DEFAULT 'medium',
  location TEXT,
  lat DECIMAL(10,7),
  lng DECIMAL(10,7),
  description TEXT NOT NULL,
  submitted_by_id UUID REFERENCES users(id),
  submitted_by_name TEXT,
  contact_email TEXT,
  upvotes INTEGER DEFAULT 0,
  assigned_department TEXT,
  internal_remarks TEXT,
  submitted_date DATE DEFAULT CURRENT_DATE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Resolution History
CREATE TABLE report_resolution_history (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  report_id TEXT REFERENCES citizen_reports(id) ON DELETE CASCADE,
  action TEXT NOT NULL,
  actor TEXT,
  actor_id UUID REFERENCES users(id),
  action_date DATE DEFAULT CURRENT_DATE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Project Photos
CREATE TABLE project_photos (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  project_id TEXT REFERENCES projects(id) ON DELETE CASCADE,
  storage_path TEXT NOT NULL,
  caption TEXT,
  uploaded_by UUID REFERENCES users(id),
  upload_date DATE DEFAULT CURRENT_DATE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Notifications
CREATE TABLE notifications (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  type TEXT CHECK (type IN ('critical','warning','info','success')) DEFAULT 'info',
  message TEXT NOT NULL,
  target_user UUID REFERENCES users(id),
  read BOOLEAN DEFAULT FALSE,
  related_project TEXT REFERENCES projects(id),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Audit Logs
CREATE TABLE audit_logs (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES users(id),
  action TEXT NOT NULL,
  entity_type TEXT NOT NULL,
  entity_id TEXT,
  old_values JSONB,
  new_values JSONB,
  ip_address TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Row Level Security
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE projects ENABLE ROW LEVEL SECURITY;
ALTER TABLE citizen_reports ENABLE ROW LEVEL SECURITY;
ALTER TABLE inspections ENABLE ROW LEVEL SECURITY;

-- Public can view projects
CREATE POLICY "projects_public_read" ON projects FOR SELECT USING (true);

-- Only admins can modify projects
CREATE POLICY "projects_admin_write" ON projects FOR ALL 
  USING (EXISTS (SELECT 1 FROM users WHERE auth_id = auth.uid() AND role = 'admin'));

-- Citizens can view their own reports
CREATE POLICY "reports_own_read" ON citizen_reports FOR SELECT 
  USING (submitted_by_id = (SELECT id FROM users WHERE auth_id = auth.uid()));

-- Everyone can insert reports
CREATE POLICY "reports_insert" ON citizen_reports FOR INSERT WITH CHECK (true);

-- Admins can manage all reports
CREATE POLICY "reports_admin_all" ON citizen_reports FOR ALL 
  USING (EXISTS (SELECT 1 FROM users WHERE auth_id = auth.uid() AND role = 'admin'));

-- Indexes for performance
CREATE INDEX idx_projects_status ON projects(status);
CREATE INDEX idx_projects_ward ON projects(ward);
CREATE INDEX idx_projects_category ON projects(category);
CREATE INDEX idx_citizen_reports_status ON citizen_reports(status);
CREATE INDEX idx_citizen_reports_submitted_by ON citizen_reports(submitted_by_id);
CREATE INDEX idx_audit_logs_user ON audit_logs(user_id);
CREATE INDEX idx_audit_logs_created_at ON audit_logs(created_at);
