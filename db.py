"""
ProjectPulse Database & Persistence Layer
Supports SQLite (zero-config, local, durable) and PostgreSQL / Supabase
"""
import os
import json
import sqlite3
import datetime
from pathlib import Path

DB_FILE = Path(__file__).parent / "projectpulse.db"

def get_db():
    conn = sqlite3.connect(DB_FILE, timeout=10.0)
    conn.row_factory = sqlite3.Row
    conn.execute("PRAGMA foreign_keys = ON")
    return conn

def init_db():
    """Initializes all database tables and constraints."""
    with get_db() as conn:
        cursor = conn.cursor()
        
        # 1. Users Table
        cursor.execute("""
        CREATE TABLE IF NOT EXISTS users (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            google_id TEXT UNIQUE,
            name TEXT NOT NULL,
            role TEXT NOT NULL DEFAULT 'citizen' CHECK (role IN ('admin','field_inspector','contractor','citizen')),
            email TEXT UNIQUE NOT NULL,
            ward INTEGER,
            avatar TEXT,
            created_at TEXT DEFAULT (datetime('now')),
            last_login TEXT
        )
        """)

        # 2. Departments Table
        cursor.execute("""
        CREATE TABLE IF NOT EXISTS departments (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            name TEXT NOT NULL UNIQUE,
            head TEXT,
            contact_email TEXT,
            created_at TEXT DEFAULT (datetime('now'))
        )
        """)

        # 3. Contractors Table
        cursor.execute("""
        CREATE TABLE IF NOT EXISTS contractors (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            name TEXT NOT NULL UNIQUE,
            registration_number TEXT,
            contact_person TEXT,
            contact_email TEXT,
            rating REAL DEFAULT 4.5,
            active_projects INTEGER DEFAULT 0,
            created_at TEXT DEFAULT (datetime('now'))
        )
        """)

        # 4. Projects Table
        cursor.execute("""
        CREATE TABLE IF NOT EXISTS projects (
            id TEXT PRIMARY KEY,
            name TEXT NOT NULL,
            category TEXT NOT NULL CHECK (category IN ('transit','bridges','water','parks','public_facilities')),
            ward INTEGER NOT NULL,
            department TEXT NOT NULL,
            contractor TEXT NOT NULL,
            status TEXT NOT NULL CHECK (status IN ('on_track','under_review','critical','completed')) DEFAULT 'on_track',
            budget REAL NOT NULL DEFAULT 0,
            disbursed REAL NOT NULL DEFAULT 0,
            actual_progress INTEGER DEFAULT 0 CHECK (actual_progress BETWEEN 0 AND 100),
            planned_progress INTEGER DEFAULT 0 CHECK (planned_progress BETWEEN 0 AND 100),
            schedule_variance INTEGER DEFAULT 0,
            start_date TEXT,
            deadline TEXT,
            estimated_completion TEXT,
            lat REAL NOT NULL,
            lng REAL NOT NULL,
            location TEXT NOT NULL,
            description TEXT,
            tags TEXT,
            created_at TEXT DEFAULT (datetime('now')),
            updated_at TEXT DEFAULT (datetime('now'))
        )
        """)

        # 5. Project Milestones Table
        cursor.execute("""
        CREATE TABLE IF NOT EXISTS project_milestones (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            project_id TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
            milestone_id INTEGER NOT NULL,
            name TEXT NOT NULL,
            target_date TEXT,
            completed INTEGER DEFAULT 0,
            completed_date TEXT,
            order_index INTEGER DEFAULT 0,
            created_at TEXT DEFAULT (datetime('now')),
            UNIQUE(project_id, milestone_id)
        )
        """)

        # 6. Inspections Table
        cursor.execute("""
        CREATE TABLE IF NOT EXISTS inspections (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            project_id TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
            inspector_name TEXT NOT NULL,
            inspection_type TEXT NOT NULL,
            result TEXT NOT NULL,
            notes TEXT,
            inspection_date TEXT NOT NULL,
            created_at TEXT DEFAULT (datetime('now'))
        )
        """)

        # 7. Progress History Table
        cursor.execute("""
        CREATE TABLE IF NOT EXISTS progress_history (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            project_id TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
            month TEXT NOT NULL,
            actual INTEGER NOT NULL,
            planned INTEGER NOT NULL,
            created_at TEXT DEFAULT (datetime('now')),
            UNIQUE(project_id, month)
        )
        """)

        # 8. Citizen Reports Table
        cursor.execute("""
        CREATE TABLE IF NOT EXISTS citizen_reports (
            id TEXT PRIMARY KEY,
            title TEXT NOT NULL,
            category TEXT NOT NULL,
            status TEXT NOT NULL CHECK (status IN ('critical','under_review','assigned','resolved')) DEFAULT 'under_review',
            priority TEXT NOT NULL CHECK (priority IN ('low','medium','high','critical')) DEFAULT 'medium',
            location TEXT NOT NULL,
            lat REAL NOT NULL,
            lng REAL NOT NULL,
            description TEXT NOT NULL,
            submitted_by_id INTEGER REFERENCES users(id),
            submitted_by_name TEXT NOT NULL,
            contact_email TEXT,
            upvotes INTEGER DEFAULT 0,
            photos INTEGER DEFAULT 0,
            assigned_department TEXT,
            internal_remarks TEXT,
            submitted_date TEXT NOT NULL,
            created_at TEXT DEFAULT (datetime('now')),
            updated_at TEXT DEFAULT (datetime('now'))
        )
        """)

        # 9. Report Resolution History Table
        cursor.execute("""
        CREATE TABLE IF NOT EXISTS report_resolution_history (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            report_id TEXT NOT NULL REFERENCES citizen_reports(id) ON DELETE CASCADE,
            action TEXT NOT NULL,
            actor TEXT NOT NULL,
            action_date TEXT NOT NULL,
            created_at TEXT DEFAULT (datetime('now'))
        )
        """)

        # 10. Uploaded Files Table
        cursor.execute("""
        CREATE TABLE IF NOT EXISTS uploaded_files (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            filename TEXT NOT NULL,
            original_name TEXT NOT NULL,
            file_path TEXT NOT NULL,
            file_url TEXT NOT NULL,
            file_size INTEGER NOT NULL,
            mime_type TEXT NOT NULL,
            related_entity TEXT,
            entity_id TEXT,
            uploaded_by_id INTEGER REFERENCES users(id),
            uploaded_at TEXT DEFAULT (datetime('now'))
        )
        """)

        # 11. Notifications Table
        cursor.execute("""
        CREATE TABLE IF NOT EXISTS notifications (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            type TEXT NOT NULL CHECK (type IN ('critical','warning','info','success')) DEFAULT 'info',
            message TEXT NOT NULL,
            time TEXT NOT NULL,
            read INTEGER DEFAULT 0,
            related_project TEXT,
            created_at TEXT DEFAULT (datetime('now'))
        )
        """)

        # 12. Sessions Table
        cursor.execute("""
        CREATE TABLE IF NOT EXISTS sessions (
            session_id TEXT PRIMARY KEY,
            user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
            created_at TEXT DEFAULT (datetime('now')),
            expires_at TEXT NOT NULL
        )
        """)

        # Create Indexes for query performance
        cursor.execute("CREATE INDEX IF NOT EXISTS idx_proj_status ON projects(status)")
        cursor.execute("CREATE INDEX IF NOT EXISTS idx_proj_ward ON projects(ward)")
        cursor.execute("CREATE INDEX IF NOT EXISTS idx_proj_cat ON projects(category)")
        cursor.execute("CREATE INDEX IF NOT EXISTS idx_rep_status ON citizen_reports(status)")
        cursor.execute("CREATE INDEX IF NOT EXISTS idx_rep_sub_id ON citizen_reports(submitted_by_id)")
        cursor.execute("CREATE INDEX IF NOT EXISTS idx_sess_exp ON sessions(expires_at)")

        conn.commit()

def seed_sample_data():
    """
    Idempotent database seeder.
    Reads sample data from data/projects.js and seeds it safely into SQLite if not present.
    """
    with get_db() as conn:
        cursor = conn.cursor()
        
        # Check if projects already seeded
        cursor.execute("SELECT COUNT(*) FROM projects")
        if cursor.fetchone()[0] > 0:
            return  # Already seeded! Safe and idempotent.

        # 1. Seed Users
        users_seed = [
            ("Commissioner Sarah Blake", "admin", "s.blake@citygov.org", None, "SB"),
            ("Inspector David Chen", "field_inspector", "d.chen@citygov.org", 4, "DC"),
            ("Project Manager Maria Lopez", "contractor", "m.lopez@skanska-apex.com", None, "ML"),
            ("Citizen User", "citizen", "citizen@email.com", 4, "CU")
        ]
        for name, role, email, ward, avatar in users_seed:
            cursor.execute("""
            INSERT OR IGNORE INTO users (name, role, email, ward, avatar)
            VALUES (?, ?, ?, ?, ?)
            """, (name, role, email, ward, avatar))

        # 2. Seed Departments
        dept_seed = [
            "Department of Transportation",
            "Bridges & Safety Division",
            "Water & Utilities",
            "Public Health & Facilities",
            "Metropolitan Transit Authority",
            "Parks & Recreation",
            "Public Works",
            "Electrical Services"
        ]
        for d in dept_seed:
            cursor.execute("INSERT OR IGNORE INTO departments (name) VALUES (?)", (d,))

        # 3. Seed Notifications
        notif_seed = [
            ("critical", "Maple Parkway Viaduct – 18 day delay detected", "2h ago", 0, "PP-2023-047"),
            ("warning", "North Greenline Rail – Budget utilization at 69.5%", "4h ago", 0, "PP-2023-089"),
            ("info", "New citizen report: Water leak Ward 1 (Critical priority)", "6h ago", 0, None),
            ("success", "Southside Health Center milestone 3 completed", "1d ago", 1, "PP-2024-033"),
            ("info", "Monthly project review scheduled for Nov 1, 2024", "2d ago", 1, None)
        ]
        for n_type, msg, t_str, rd, rel_p in notif_seed:
            cursor.execute("""
            INSERT INTO notifications (type, message, time, read, related_project)
            VALUES (?, ?, ?, ?, ?)
            """, (n_type, msg, t_str, rd, rel_p))

        # 4. Seed 8 Projects with Milestones, Inspections, and Progress History
        projects_data = [
            {
                "id": "PP-2024-001",
                "name": "Central Waterfront Transit Hub",
                "category": "transit",
                "ward": 4,
                "department": "Department of Transportation",
                "contractor": "Skanska-Apex JV",
                "status": "on_track",
                "budget": 84200000,
                "disbursed": 58400000,
                "actualProgress": 68,
                "plannedProgress": 65,
                "startDate": "2023-03-15",
                "deadline": "2025-11-30",
                "estimatedCompletion": "2025-10-20",
                "scheduleVariance": 3,
                "lat": 37.8044,
                "lng": -122.2712,
                "location": "Central Waterfront, Ward 4",
                "description": "Multi-modal transit center with high-capacity ferry terminal, light rail connection, and urban plaza development.",
                "tags": ["high-priority", "phase-3"],
                "milestones": [
                    {"id": 1, "name": "Site Preparation", "completed": True, "date": "2023-05-01", "completedDate": "2023-04-28"},
                    {"id": 2, "name": "Foundation Work", "completed": True, "date": "2023-09-01", "completedDate": "2023-08-30"},
                    {"id": 3, "name": "Steel Framework", "completed": True, "date": "2024-02-01", "completedDate": "2024-01-25"},
                    {"id": 4, "name": "Platform Construction", "completed": True, "date": "2024-08-01", "completedDate": "2024-07-20"},
                    {"id": 5, "name": "MEP Systems Installation", "completed": False, "date": "2025-03-01", "completedDate": None},
                    {"id": 6, "name": "Final Fit-out & Commissioning", "completed": False, "date": "2025-10-01", "completedDate": None}
                ],
                "inspections": [
                    {"date": "2024-10-15", "inspector": "David Chen", "type": "Structural", "result": "Pass", "notes": "Phase 4 concrete work meets spec."},
                    {"date": "2024-09-02", "inspector": "Maria Lopez", "type": "Safety", "result": "Pass", "notes": "All safety protocols in compliance."}
                ],
                "progressHistory": [
                    {"month": "2024-05", "actual": 35, "planned": 33},
                    {"month": "2024-06", "actual": 42, "planned": 40},
                    {"month": "2024-07", "actual": 50, "planned": 48},
                    {"month": "2024-08", "actual": 56, "planned": 55},
                    {"month": "2024-09", "actual": 61, "planned": 59},
                    {"month": "2024-10", "actual": 68, "planned": 65}
                ]
            },
            {
                "id": "PP-2023-047",
                "name": "Maple Parkway Viaduct Seismic Retrofit",
                "category": "bridges",
                "ward": 2,
                "department": "Bridges & Safety Division",
                "contractor": "Pacific Span Ltd.",
                "status": "critical",
                "budget": 127500000,
                "disbursed": 89200000,
                "actualProgress": 54,
                "plannedProgress": 72,
                "startDate": "2023-01-10",
                "deadline": "2025-06-30",
                "estimatedCompletion": "2025-10-15",
                "scheduleVariance": -18,
                "lat": 37.7749,
                "lng": -122.4194,
                "location": "Maple Parkway, Ward 2",
                "description": "Critical seismic retrofit of 1.2km elevated viaduct. Includes pier strengthening, bearing replacement, and deck rehabilitation to current seismic standards.",
                "tags": ["critical-delay", "seismic"],
                "milestones": [
                    {"id": 1, "name": "Engineering Assessment", "completed": True, "date": "2023-03-01", "completedDate": "2023-02-28"},
                    {"id": 2, "name": "Procurement & Permits", "completed": True, "date": "2023-07-01", "completedDate": "2023-07-15"},
                    {"id": 3, "name": "Foundation Strengthening", "completed": True, "date": "2024-01-01", "completedDate": "2024-01-20"},
                    {"id": 4, "name": "Pier Retrofit Phase 1", "completed": False, "date": "2024-08-01", "completedDate": None},
                    {"id": 5, "name": "Pier Retrofit Phase 2", "completed": False, "date": "2025-02-01", "completedDate": None},
                    {"id": 6, "name": "Deck & Bearing Replacement", "completed": False, "date": "2025-05-01", "completedDate": None},
                    {"id": 7, "name": "Load Testing & Sign-off", "completed": False, "date": "2025-06-01", "completedDate": None}
                ],
                "inspections": [
                    {"date": "2024-10-10", "inspector": "Robert Kim", "type": "Structural", "result": "Needs Attention", "notes": "Pier Base 07 concrete pour on hold pending spec audit. Inspector signature missing for batch resilience testing."},
                    {"date": "2024-09-18", "inspector": "Sarah Johnson", "type": "Safety", "result": "Pass", "notes": "Worker safety protocols compliant."}
                ],
                "progressHistory": [
                    {"month": "2024-05", "actual": 38, "planned": 55},
                    {"month": "2024-06", "actual": 42, "planned": 60},
                    {"month": "2024-07", "actual": 46, "planned": 64},
                    {"month": "2024-08", "actual": 50, "planned": 67},
                    {"month": "2024-09", "actual": 52, "planned": 70},
                    {"month": "2024-10", "actual": 54, "planned": 72}
                ]
            },
            {
                "id": "PP-2024-012",
                "name": "East River Stormwater Facility",
                "category": "water",
                "ward": 7,
                "department": "Water & Utilities",
                "contractor": "HydroConstruct LLC",
                "status": "under_review",
                "budget": 43800000,
                "disbursed": 31200000,
                "actualProgress": 78,
                "plannedProgress": 85,
                "startDate": "2023-06-01",
                "deadline": "2025-03-31",
                "estimatedCompletion": "2025-05-15",
                "scheduleVariance": -7,
                "lat": 37.7600,
                "lng": -122.3900,
                "location": "East River Basin, Ward 7",
                "description": "Subsurface stormwater retention basin and pumping station designed to prevent urban flooding across 3 adjacent districts.",
                "tags": ["flood-resilience"],
                "milestones": [
                    {"id": 1, "name": "Excavation", "completed": True, "date": "2023-09-01", "completedDate": "2023-08-25"},
                    {"id": 2, "name": "Retention Basin Pour", "completed": True, "date": "2024-02-01", "completedDate": "2024-02-10"},
                    {"id": 3, "name": "Pump Station Structure", "completed": True, "date": "2024-07-01", "completedDate": "2024-07-15"},
                    {"id": 4, "name": "Electrical & Controls", "completed": False, "date": "2024-12-01", "completedDate": None},
                    {"id": 5, "name": "System Integration Testing", "completed": False, "date": "2025-03-01", "completedDate": None}
                ],
                "inspections": [
                    {"date": "2024-10-08", "inspector": "David Chen", "type": "Environmental", "result": "Pass", "notes": "Runoff mitigation compliant with EPA standards."}
                ],
                "progressHistory": [
                    {"month": "2024-05", "actual": 52, "planned": 55},
                    {"month": "2024-06", "actual": 60, "planned": 63},
                    {"month": "2024-07", "actual": 68, "planned": 71},
                    {"month": "2024-08", "actual": 72, "planned": 77},
                    {"month": "2024-09", "actual": 75, "planned": 81},
                    {"month": "2024-10", "actual": 78, "planned": 85}
                ]
            },
            {
                "id": "PP-2024-033",
                "name": "Southside Community Health Center",
                "category": "public_facilities",
                "ward": 9,
                "department": "Public Health & Facilities",
                "contractor": "CivicBuild Partners",
                "status": "on_track",
                "budget": 31200000,
                "disbursed": 28100000,
                "actualProgress": 91,
                "plannedProgress": 90,
                "startDate": "2023-04-01",
                "deadline": "2025-01-31",
                "estimatedCompletion": "2025-01-15",
                "scheduleVariance": 1,
                "lat": 37.7500,
                "lng": -122.4200,
                "location": "Southside District, Ward 9",
                "description": "Modern 4-story ambulatory care center with diagnostic imaging, dental clinic, mental health wing, and urgent care facilities.",
                "tags": ["healthcare", "near-completion"],
                "milestones": [
                    {"id": 1, "name": "Superstructure Complete", "completed": True, "date": "2023-10-01", "completedDate": "2023-09-28"},
                    {"id": 2, "name": "Exterior Envelope", "completed": True, "date": "2024-03-01", "completedDate": "2024-02-25"},
                    {"id": 3, "name": "Interior Fit-out", "completed": True, "date": "2024-08-01", "completedDate": "2024-08-10"},
                    {"id": 4, "name": "Medical Equipment Installation", "completed": True, "date": "2024-10-01", "completedDate": "2024-10-05"},
                    {"id": 5, "name": "Final Inspection & Licensing", "completed": False, "date": "2025-01-01", "completedDate": None}
                ],
                "inspections": [
                    {"date": "2024-10-18", "inspector": "David Chen", "type": "Healthcare Compliance", "result": "Pass", "notes": "All clean room specs meet Department of Health standards."},
                    {"date": "2024-09-12", "inspector": "Maria Lopez", "type": "Fire & Life Safety", "result": "Pass", "notes": "Fire suppression and egress systems verified."}
                ],
                "progressHistory": [
                    {"month": "2024-05", "actual": 62, "planned": 60},
                    {"month": "2024-06", "actual": 71, "planned": 70},
                    {"month": "2024-07", "actual": 79, "planned": 78},
                    {"month": "2024-08", "actual": 85, "planned": 84},
                    {"month": "2024-09", "actual": 88, "planned": 87},
                    {"month": "2024-10", "actual": 91, "planned": 90}
                ]
            },
            {
                "id": "PP-2023-089",
                "name": "North Greenline Light Rail Extension",
                "category": "transit",
                "ward": 1,
                "department": "Metropolitan Transit Authority",
                "contractor": "Consolidated Railworks",
                "status": "critical",
                "budget": 285000000,
                "disbursed": 198000000,
                "actualProgress": 48,
                "plannedProgress": 67,
                "startDate": "2022-09-01",
                "deadline": "2025-12-31",
                "estimatedCompletion": "2026-06-30",
                "scheduleVariance": -19,
                "lat": 37.8200,
                "lng": -122.3100,
                "location": "North Corridor, Ward 1",
                "description": "5.4-mile light rail extension with 6 new stations, park-and-ride facilities, and grade separation through congested urban intersections.",
                "tags": ["major-capital", "critical-delay"],
                "milestones": [
                    {"id": 1, "name": "Environmental Impact Review", "completed": True, "date": "2022-12-01", "completedDate": "2022-12-15"},
                    {"id": 2, "name": "Utility Relocation", "completed": True, "date": "2023-06-01", "completedDate": "2023-08-01"},
                    {"id": 3, "name": "Guideway Construction", "completed": False, "date": "2024-04-01", "completedDate": None},
                    {"id": 4, "name": "Station Framing", "completed": False, "date": "2024-10-01", "completedDate": None},
                    {"id": 5, "name": "Track Laying & Electrification", "completed": False, "date": "2025-05-01", "completedDate": None},
                    {"id": 6, "name": "Signaling & Testing", "completed": False, "date": "2025-11-01", "completedDate": None}
                ],
                "inspections": [
                    {"date": "2024-10-02", "inspector": "David Chen", "type": "Track Alignment", "result": "Needs Attention", "notes": "Sub-grade settlement detected at Station 3 approach. Geotechnical review required."},
                    {"date": "2024-08-15", "inspector": "Sarah Johnson", "type": "Safety", "result": "Pass", "notes": "Corridor traffic control meeting standards."}
                ],
                "progressHistory": [
                    {"month": "2024-05", "actual": 39, "planned": 52},
                    {"month": "2024-06", "actual": 41, "planned": 56},
                    {"month": "2024-07", "actual": 43, "planned": 60},
                    {"month": "2024-08", "actual": 45, "planned": 63},
                    {"month": "2024-09", "actual": 47, "planned": 65},
                    {"month": "2024-10", "actual": 48, "planned": 67}
                ]
            },
            {
                "id": "PP-2024-022",
                "name": "Westside Stormwater Treatment Plant",
                "category": "water",
                "ward": 5,
                "department": "Water & Utilities",
                "contractor": "HydroConstruct LLC",
                "status": "on_track",
                "budget": 22400000,
                "disbursed": 16800000,
                "actualProgress": 74,
                "plannedProgress": 72,
                "startDate": "2023-07-01",
                "deadline": "2025-04-30",
                "estimatedCompletion": "2025-04-15",
                "scheduleVariance": 2,
                "lat": 37.7800,
                "lng": -122.4500,
                "location": "Westside Industrial Park, Ward 5",
                "description": "Secondary treatment facility expansion with advanced filtration membranes and UV disinfection system.",
                "tags": ["water-quality"],
                "milestones": [
                    {"id": 1, "name": "Civil Works", "completed": True, "date": "2023-11-01", "completedDate": "2023-10-25"},
                    {"id": 2, "name": "Basin Construction", "completed": True, "date": "2024-03-01", "completedDate": "2024-03-10"},
                    {"id": 3, "name": "Membrane Installation", "completed": True, "date": "2024-08-01", "completedDate": "2024-07-30"},
                    {"id": 4, "name": "Piping & Valves", "completed": False, "date": "2024-12-01", "completedDate": None},
                    {"id": 5, "name": "Commissioning", "completed": False, "date": "2025-04-01", "completedDate": None}
                ],
                "inspections": [
                    {"date": "2024-09-25", "inspector": "David Chen", "type": "Mechanical", "result": "Pass", "notes": "UV array testing completed at 100% capacity."}
                ],
                "progressHistory": [
                    {"month": "2024-05", "actual": 48, "planned": 46},
                    {"month": "2024-06", "actual": 55, "planned": 53},
                    {"month": "2024-07", "actual": 62, "planned": 60},
                    {"month": "2024-08", "actual": 68, "planned": 66},
                    {"month": "2024-09", "actual": 71, "planned": 69},
                    {"month": "2024-10", "actual": 74, "planned": 72}
                ]
            },
            {
                "id": "PP-2024-041",
                "name": "Harbor View Park & Recreation Center",
                "category": "parks",
                "ward": 6,
                "department": "Parks & Recreation",
                "contractor": "GreenScapes Infrastructure",
                "status": "on_track",
                "budget": 8600000,
                "disbursed": 6900000,
                "actualProgress": 82,
                "plannedProgress": 80,
                "startDate": "2023-08-15",
                "deadline": "2025-02-28",
                "estimatedCompletion": "2025-02-15",
                "scheduleVariance": 2,
                "lat": 37.8100,
                "lng": -122.2500,
                "location": "Harbor View, Ward 6",
                "description": "Comprehensive park revitalization including inclusive all-abilities playground, community center with gymnasium, walking trails, and native botanical gardens.",
                "tags": ["civic", "community"],
                "milestones": [
                    {"id": 1, "name": "Grading & Drainage", "completed": True, "date": "2023-11-01", "completedDate": "2023-10-28"},
                    {"id": 2, "name": "Community Center Shell", "completed": True, "date": "2024-03-01", "completedDate": "2024-03-05"},
                    {"id": 3, "name": "Playground Installation", "completed": True, "date": "2024-07-01", "completedDate": "2024-06-25"},
                    {"id": 4, "name": "Trail Paving & Lighting", "completed": True, "date": "2024-10-01", "completedDate": "2024-09-30"},
                    {"id": 5, "name": "Landscape & Signage", "completed": False, "date": "2025-02-01", "completedDate": None}
                ],
                "inspections": [
                    {"date": "2024-10-12", "inspector": "David Chen", "type": "ADA Compliance", "result": "Pass", "notes": "All playground access routes fully meet ADA standards."}
                ],
                "progressHistory": [
                    {"month": "2024-05", "actual": 42, "planned": 40},
                    {"month": "2024-06", "actual": 53, "planned": 51},
                    {"month": "2024-07", "actual": 64, "planned": 62},
                    {"month": "2024-08", "actual": 72, "planned": 70},
                    {"month": "2024-09", "actual": 78, "planned": 76},
                    {"month": "2024-10", "actual": 82, "planned": 80}
                ]
            },
            {
                "id": "PP-2024-058",
                "name": "Downtown Road Resurfacing & Complete Streets Phase 3",
                "category": "bridges",
                "ward": 3,
                "department": "Public Works",
                "contractor": "Metro Paving Corp",
                "status": "under_review",
                "budget": 15300000,
                "disbursed": 9200000,
                "actualProgress": 58,
                "plannedProgress": 65,
                "startDate": "2024-01-15",
                "deadline": "2025-05-31",
                "estimatedCompletion": "2025-07-15",
                "scheduleVariance": -7,
                "lat": 37.7950,
                "lng": -122.4000,
                "location": "Downtown Core, Ward 3",
                "description": "8.2 miles of roadway milling and resurfacing, protected bike lanes, pedestrian bulb-outs, signal modernization, and green infrastructure storm drain grates.",
                "tags": ["roads", "complete-streets"],
                "milestones": [
                    {"id": 1, "name": "Utility Coordination", "completed": True, "date": "2024-03-01", "completedDate": "2024-03-15"},
                    {"id": 2, "name": "Sector A Milling & Paving", "completed": True, "date": "2024-06-01", "completedDate": "2024-06-10"},
                    {"id": 3, "name": "Sector B Resurfacing", "completed": True, "date": "2024-09-01", "completedDate": "2024-09-20"},
                    {"id": 4, "name": "Bike Lane Infrastructure", "completed": False, "date": "2024-12-01", "completedDate": None},
                    {"id": 5, "name": "Signalization & Striping", "completed": False, "date": "2025-04-01", "completedDate": None}
                ],
                "inspections": [
                    {"date": "2024-09-28", "inspector": "David Chen", "type": "Pavement Density", "result": "Needs Attention", "notes": "Sector B core sample #4 density 91.2% (spec requires 93%). Retest scheduled."}
                ],
                "progressHistory": [
                    {"month": "2024-05", "actual": 22, "planned": 28},
                    {"month": "2024-06", "actual": 34, "planned": 40},
                    {"month": "2024-07", "actual": 42, "planned": 48},
                    {"month": "2024-08", "actual": 49, "planned": 55},
                    {"month": "2024-09", "actual": 54, "planned": 60},
                    {"month": "2024-10", "actual": 58, "planned": 65}
                ]
            }
        ]

        for p in projects_data:
            cursor.execute("""
            INSERT OR IGNORE INTO projects (
                id, name, category, ward, department, contractor, status,
                budget, disbursed, actual_progress, planned_progress, schedule_variance,
                start_date, deadline, estimated_completion, lat, lng, location,
                description, tags
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            """, (
                p["id"], p["name"], p["category"], p["ward"], p["department"], p["contractor"], p["status"],
                p["budget"], p["disbursed"], p["actualProgress"], p["plannedProgress"], p["scheduleVariance"],
                p["startDate"], p["deadline"], p["estimatedCompletion"], p["lat"], p["lng"], p["location"],
                p["description"], json.dumps(p["tags"])
            ))

            for m in p.get("milestones", []):
                cursor.execute("""
                INSERT OR IGNORE INTO project_milestones (
                    project_id, milestone_id, name, target_date, completed, completed_date, order_index
                ) VALUES (?, ?, ?, ?, ?, ?, ?)
                """, (p["id"], m["id"], m["name"], m["date"], 1 if m["completed"] else 0, m["completedDate"], m["id"]))

            for i in p.get("inspections", []):
                cursor.execute("""
                INSERT INTO inspections (
                    project_id, inspector_name, inspection_type, result, notes, inspection_date
                ) VALUES (?, ?, ?, ?, ?, ?)
                """, (p["id"], i["inspector"], i["type"], i["result"], i["notes"], i["date"]))

            for ph in p.get("progressHistory", []):
                cursor.execute("""
                INSERT OR IGNORE INTO progress_history (
                    project_id, month, actual, planned
                ) VALUES (?, ?, ?, ?)
                """, (p["id"], ph["month"], ph["actual"], ph["planned"]))

        # 5. Seed Citizen Reports
        reports_seed = [
            {
                "id": "CR-2024-1892",
                "title": "Road subsidence near Central Waterfront access gate",
                "category": "road_damage",
                "status": "under_review",
                "priority": "high",
                "location": "Pier 14 Access Rd, Ward 4",
                "lat": 37.8012,
                "lng": -122.2745,
                "description": "Asphalt subsidence along maritime access corridor. Multiple large potholes forming at junction of Pier Road and Industrial Ave.",
                "submittedDate": "2024-10-18",
                "submittedBy": "Anonymous Citizen",
                "contact": "",
                "upvotes": 14,
                "photos": 2,
                "assignedDepartment": "Public Works",
                "internalRemarks": "Field crew dispatched for assessment 10/20.",
                "resolutionHistory": []
            },
            {
                "id": "CR-2024-1856",
                "title": "Street lighting outage on Maple Ave block 4",
                "category": "infrastructure_safety",
                "status": "assigned",
                "priority": "medium",
                "location": "Maple Avenue, Ward 2",
                "lat": 37.7749,
                "lng": -122.4094,
                "description": "6 consecutive streetlights not functioning for 3 days. Safety hazard for pedestrians at night.",
                "submittedDate": "2024-10-15",
                "submittedBy": "John D.",
                "contact": "john.d@email.com",
                "upvotes": 8,
                "photos": 1,
                "assignedDepartment": "Electrical Services",
                "internalRemarks": "",
                "resolutionHistory": []
            },
            {
                "id": "CR-2024-1823",
                "title": "Water main leak – North Greenline construction zone",
                "category": "water_supply",
                "status": "critical",
                "priority": "critical",
                "location": "North Corridor, Ward 1",
                "lat": 37.8294,
                "lng": -122.2912,
                "description": "Visible water main leak at construction zone boundary. Water pooling on road surface. Likely caused by construction vibration.",
                "submittedDate": "2024-10-12",
                "submittedBy": "Resident Association",
                "contact": "ward1res@email.com",
                "upvotes": 31,
                "photos": 4,
                "assignedDepartment": "Water & Utilities",
                "internalRemarks": "Emergency repair team dispatched.",
                "resolutionHistory": [
                    {"date": "2024-10-13", "action": "Emergency assessment conducted", "actor": "Water Dept."}
                ]
            },
            {
                "id": "CR-2024-1799",
                "title": "Playground equipment damage – Southside Park",
                "category": "public_facility",
                "status": "resolved",
                "priority": "medium",
                "location": "Southside Park, Ward 9",
                "lat": 37.7599,
                "lng": -122.4477,
                "description": "Swing set chains broken and slide has sharp edges. Safety risk for children.",
                "submittedDate": "2024-10-05",
                "submittedBy": "Parent Group",
                "contact": "",
                "upvotes": 22,
                "photos": 3,
                "assignedDepartment": "Parks & Recreation",
                "internalRemarks": "Equipment replaced and inspected.",
                "resolutionHistory": [
                    {"date": "2024-10-08", "action": "Work order issued", "actor": "Parks Dept."},
                    {"date": "2024-10-14", "action": "Equipment replaced", "actor": "Maintenance Crew"},
                    {"date": "2024-10-15", "action": "Safety inspection completed – PASS", "actor": "Inspector"}
                ]
            },
            {
                "id": "CR-2024-1764",
                "title": "Dust and noise pollution from construction – Ward 4",
                "category": "public_facility",
                "status": "under_review",
                "priority": "low",
                "location": "Waterfront District, Ward 4",
                "lat": 37.8044,
                "lng": -122.2812,
                "description": "Excessive dust from Central Waterfront Transit Hub construction affecting nearby residences. Noise levels exceeding permitted hours.",
                "submittedDate": "2024-09-28",
                "submittedBy": "Neighborhood Watch",
                "contact": "ward4nw@email.com",
                "upvotes": 11,
                "photos": 2,
                "assignedDepartment": "Department of Transportation",
                "internalRemarks": "Contractor notified. Mitigation measures requested.",
                "resolutionHistory": []
            }
        ]

        for r in reports_seed:
            cursor.execute("""
            INSERT OR IGNORE INTO citizen_reports (
                id, title, category, status, priority, location, lat, lng,
                description, submitted_by_name, contact_email, upvotes, photos,
                assigned_department, internal_remarks, submitted_date
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            """, (
                r["id"], r["title"], r["category"], r["status"], r["priority"],
                r["location"], r["lat"], r["lng"], r["description"], r["submittedBy"],
                r["contact"], r["upvotes"], r["photos"], r["assignedDepartment"],
                r["internalRemarks"], r["submittedDate"]
            ))

            for hist in r.get("resolutionHistory", []):
                cursor.execute("""
                INSERT INTO report_resolution_history (report_id, action, actor, action_date)
                VALUES (?, ?, ?, ?)
                """, (r["id"], hist["action"], hist["actor"], hist["date"]))

        conn.commit()

# Query & Mutation Helpers

def get_all_projects():
    with get_db() as conn:
        cursor = conn.cursor()
        cursor.execute("SELECT * FROM projects ORDER BY created_at ASC")
        projects = [dict(row) for row in cursor.fetchall()]
        
        for p in projects:
            p["tags"] = json.loads(p["tags"]) if p["tags"] else []
            p["actualProgress"] = p["actual_progress"]
            p["plannedProgress"] = p["planned_progress"]
            p["scheduleVariance"] = p["schedule_variance"]
            p["startDate"] = p["start_date"]
            p["estimatedCompletion"] = p["estimated_completion"]

            # Milestones
            cursor.execute("SELECT * FROM project_milestones WHERE project_id = ? ORDER BY order_index ASC", (p["id"],))
            p["milestones"] = [{
                "id": m["milestone_id"],
                "name": m["name"],
                "date": m["target_date"],
                "completed": bool(m["completed"]),
                "completedDate": m["completed_date"]
            } for m in cursor.fetchall()]

            # Inspections
            cursor.execute("SELECT * FROM inspections WHERE project_id = ? ORDER BY inspection_date DESC", (p["id"],))
            p["inspections"] = [{
                "date": i["inspection_date"],
                "inspector": i["inspector_name"],
                "type": i["inspection_type"],
                "result": i["result"],
                "notes": i["notes"]
            } for i in cursor.fetchall()]

            # Progress History
            cursor.execute("SELECT * FROM progress_history WHERE project_id = ? ORDER BY month ASC", (p["id"],))
            p["progressHistory"] = [{
                "month": ph["month"],
                "actual": ph["actual"],
                "planned": ph["planned"]
            } for ph in cursor.fetchall()]

        return projects

def get_project_by_id(project_id):
    with get_db() as conn:
        cursor = conn.cursor()
        cursor.execute("SELECT * FROM projects WHERE id = ?", (project_id,))
        row = cursor.fetchone()
        if not row:
            return None
        p = dict(row)
        p["tags"] = json.loads(p["tags"]) if p["tags"] else []
        p["actualProgress"] = p["actual_progress"]
        p["plannedProgress"] = p["planned_progress"]
        p["scheduleVariance"] = p["schedule_variance"]
        p["startDate"] = p["start_date"]
        p["estimatedCompletion"] = p["estimated_completion"]

        cursor.execute("SELECT * FROM project_milestones WHERE project_id = ? ORDER BY order_index ASC", (p["id"],))
        p["milestones"] = [{
            "id": m["milestone_id"],
            "name": m["name"],
            "date": m["target_date"],
            "completed": bool(m["completed"]),
            "completedDate": m["completed_date"]
        } for m in cursor.fetchall()]

        cursor.execute("SELECT * FROM inspections WHERE project_id = ? ORDER BY inspection_date DESC", (p["id"],))
        p["inspections"] = [{
            "date": i["inspection_date"],
            "inspector": i["inspector_name"],
            "type": i["inspection_type"],
            "result": i["result"],
            "notes": i["notes"]
        } for i in cursor.fetchall()]

        cursor.execute("SELECT * FROM progress_history WHERE project_id = ? ORDER BY month ASC", (p["id"],))
        p["progressHistory"] = [{
            "month": ph["month"],
            "actual": ph["actual"],
            "planned": ph["planned"]
        } for ph in cursor.fetchall()]

        return p

def create_project(data):
    with get_db() as conn:
        cursor = conn.cursor()
        project_id = data.get("id") or f"PP-{datetime.date.today().year}-{datetime.datetime.now().strftime('%f')[:4]}"
        try:
            ward = int(data.get("ward", 1) or 1)
        except (ValueError, TypeError):
            ward = 1
        name = data.get("name") or "Untitled Project"
        category = data.get("category") or "public_facilities"
        department = data.get("department") or "Public Works"
        contractor = data.get("contractor") or "TBD"
        status = data.get("status") or "on_track"
        try:
            budget = float(data.get("budget", 0) or 0)
        except (ValueError, TypeError):
            budget = 0.0
        try:
            disbursed = float(data.get("disbursed", 0) or 0)
        except (ValueError, TypeError):
            disbursed = 0.0
        try:
            actual_progress = int(data.get("actual_progress", 0) or 0)
        except (ValueError, TypeError):
            actual_progress = 0
        try:
            planned_progress = int(data.get("planned_progress", 0) or 0)
        except (ValueError, TypeError):
            planned_progress = 0
        variance = actual_progress - planned_progress
        tags_json = json.dumps(data.get("tags", []))

        cursor.execute("""
        INSERT INTO projects (
            id, name, category, ward, department, contractor, status,
            budget, disbursed, actual_progress, planned_progress, schedule_variance,
            start_date, deadline, estimated_completion, lat, lng, location, description, tags
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        """, (
            project_id, name, category, ward, department,
            contractor, status, budget,
            disbursed, actual_progress,
            planned_progress, variance, data.get("start_date"),
            data.get("deadline"), data.get("estimated_completion"),
            float(data.get("lat") or 37.79),
            float(data.get("lng") or -122.38),
            data.get("location") or f"Ward {ward}",
            data.get("description") or "",
            tags_json
        ))

        # Add initial milestones if provided
        for idx, m in enumerate(data.get("milestones", []), 1):
            cursor.execute("""
            INSERT INTO project_milestones (project_id, milestone_id, name, target_date, completed, completed_date, order_index)
            VALUES (?, ?, ?, ?, ?, ?, ?)
            """, (project_id, m.get("id", idx), m.get("name", f"Milestone {idx}"), m.get("date"), 1 if m.get("completed") else 0, m.get("completedDate"), idx))

        conn.commit()
        return get_project_by_id(project_id)

def update_project(project_id, data):
    with get_db() as conn:
        cursor = conn.cursor()
        try:
            ward = int(data.get("ward", 1) or 1)
        except (ValueError, TypeError):
            ward = 1
        name = data.get("name") or "Untitled Project"
        category = data.get("category") or "public_facilities"
        department = data.get("department") or "Public Works"
        contractor = data.get("contractor") or "TBD"
        status = data.get("status") or "on_track"
        try:
            budget = float(data.get("budget", 0) or 0)
        except (ValueError, TypeError):
            budget = 0.0
        try:
            disbursed = float(data.get("disbursed", 0) or 0)
        except (ValueError, TypeError):
            disbursed = 0.0
        try:
            actual_progress = int(data.get("actual_progress", 0) or 0)
        except (ValueError, TypeError):
            actual_progress = 0
        try:
            planned_progress = int(data.get("planned_progress", 0) or 0)
        except (ValueError, TypeError):
            planned_progress = 0
        variance = actual_progress - planned_progress

        cursor.execute("""
        UPDATE projects SET
            name = ?, category = ?, ward = ?, department = ?, contractor = ?,
            status = ?, budget = ?, disbursed = ?, actual_progress = ?, planned_progress = ?,
            schedule_variance = ?, start_date = ?, deadline = ?, estimated_completion = ?,
            lat = ?, lng = ?, location = ?, description = ?, updated_at = datetime('now')
        WHERE id = ?
        """, (
            name, category, ward, department, contractor,
            status, budget, disbursed,
            actual_progress, planned_progress, variance,
            data.get("start_date"), data.get("deadline"), data.get("estimated_completion"),
            float(data.get("lat") or 37.79), float(data.get("lng") or -122.38),
            data.get("location") or f"Ward {ward}",
            data.get("description") or "", project_id
        ))
        conn.commit()
        return get_project_by_id(project_id)

def delete_project(project_id):
    with get_db() as conn:
        cursor = conn.cursor()
        cursor.execute("DELETE FROM projects WHERE id = ?", (project_id,))
        conn.commit()
        return True

def get_all_reports(user_id=None, role=None):
    with get_db() as conn:
        cursor = conn.cursor()
        if user_id and role == 'citizen':
            # Citizen sees their own or all public reports
            cursor.execute("SELECT * FROM citizen_reports ORDER BY created_at DESC")
        else:
            cursor.execute("SELECT * FROM citizen_reports ORDER BY created_at DESC")
        
        reports = [dict(row) for row in cursor.fetchall()]
        for r in reports:
            r["submittedDate"] = r["submitted_date"]
            r["submittedBy"] = r["submitted_by_name"]
            r["contact"] = r["contact_email"]
            r["assignedDepartment"] = r["assigned_department"]
            r["internalRemarks"] = r["internal_remarks"]

            cursor.execute("SELECT * FROM report_resolution_history WHERE report_id = ? ORDER BY action_date ASC", (r["id"],))
            r["resolutionHistory"] = [{
                "date": h["action_date"],
                "action": h["action"],
                "actor": h["actor"]
            } for h in cursor.fetchall()]

        return reports

def create_citizen_report(data, user_id=None, user_name=None):
    with get_db() as conn:
        cursor = conn.cursor()
        report_id = data.get("id") or f"CR-{datetime.date.today().year}-{datetime.datetime.now().strftime('%f')[:4]}"
        submitted_by = user_name or data.get("submittedBy") or data.get("submitted_by_name") or "Citizen"
        contact = data.get("contact") or data.get("contact_email") or ""
        sub_date = data.get("submittedDate") or datetime.date.today().isoformat()

        cursor.execute("""
        INSERT INTO citizen_reports (
            id, title, category, status, priority, location, lat, lng,
            description, submitted_by_id, submitted_by_name, contact_email,
            upvotes, photos, assigned_department, internal_remarks, submitted_date
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        """, (
            report_id, data["title"], data.get("category", "road_damage"),
            data.get("status", "under_review"), data.get("priority", "medium"),
            data.get("location", ""), float(data.get("lat", 37.79)), float(data.get("lng", -122.38)),
            data.get("description", ""), user_id, submitted_by, contact,
            int(data.get("upvotes", 0)), int(data.get("photos", 0)),
            data.get("assigned_department", ""), data.get("internal_remarks", ""),
            sub_date
        ))
        conn.commit()

        # Return single report
        cursor.execute("SELECT * FROM citizen_reports WHERE id = ?", (report_id,))
        row = dict(cursor.fetchone())
        row["submittedDate"] = row["submitted_date"]
        row["submittedBy"] = row["submitted_by_name"]
        row["resolutionHistory"] = []
        return row

def update_report_status(report_id, new_status, actor_name="Admin"):
    with get_db() as conn:
        cursor = conn.cursor()
        cursor.execute("UPDATE citizen_reports SET status = ?, updated_at = datetime('now') WHERE id = ?", (new_status, report_id))
        today = datetime.date.today().isoformat()
        cursor.execute("""
        INSERT INTO report_resolution_history (report_id, action, actor, action_date)
        VALUES (?, ?, ?, ?)
        """, (report_id, f"Status changed to {new_status}", actor_name, today))
        conn.commit()
        return True

def add_report_remark(report_id, remark):
    with get_db() as conn:
        cursor = conn.cursor()
        cursor.execute("UPDATE citizen_reports SET internal_remarks = ?, updated_at = datetime('now') WHERE id = ?", (remark, report_id))
        conn.commit()
        return True

def get_all_users():
    with get_db() as conn:
        cursor = conn.cursor()
        cursor.execute("SELECT id, name, role, email, ward, avatar, created_at, last_login FROM users ORDER BY id ASC")
        return [dict(r) for r in cursor.fetchall()]

def upsert_user(google_id, name, email, avatar=None, role="citizen"):
    with get_db() as conn:
        cursor = conn.cursor()
        # Find by google_id or email
        cursor.execute("SELECT * FROM users WHERE google_id = ? OR email = ?", (google_id, email))
        user = cursor.fetchone()
        now = datetime.datetime.now().isoformat()
        
        if user:
            user_id = user["id"]
            # Preserve existing role if already set, or admin if previously admin
            current_role = user["role"]
            cursor.execute("""
            UPDATE users SET
                google_id = COALESCE(?, google_id),
                name = ?,
                avatar = COALESCE(?, avatar),
                last_login = ?
            WHERE id = ?
            """, (google_id, name, avatar, now, user_id))
            conn.commit()
            cursor.execute("SELECT id, name, role, email, ward, avatar FROM users WHERE id = ?", (user_id,))
            return dict(cursor.fetchone())
        else:
            # Generate 2-letter avatar if none provided
            if not avatar:
                words = name.split()
                avatar = (words[0][0] + words[-1][0]).toUpperCase() if len(words) >= 2 else name[:2].upper()
            cursor.execute("""
            INSERT INTO users (google_id, name, role, email, ward, avatar, last_login)
            VALUES (?, ?, ?, ?, 4, ?, ?)
            """, (google_id, name, role, email, avatar, now))
            conn.commit()
            user_id = cursor.lastrowid
            cursor.execute("SELECT id, name, role, email, ward, avatar FROM users WHERE id = ?", (user_id,))
            return dict(cursor.fetchone())

def create_user_session(user_id, session_id, days=7):
    with get_db() as conn:
        cursor = conn.cursor()
        expires = (datetime.datetime.now() + datetime.timedelta(days=days)).isoformat()
        cursor.execute("""
        INSERT INTO sessions (session_id, user_id, expires_at)
        VALUES (?, ?, ?)
        """, (session_id, user_id, expires))
        conn.commit()

def get_user_from_session(session_id):
    with get_db() as conn:
        cursor = conn.cursor()
        now = datetime.datetime.now().isoformat()
        cursor.execute("""
        SELECT u.id, u.name, u.role, u.email, u.ward, u.avatar
        FROM sessions s
        JOIN users u ON s.user_id = u.id
        WHERE s.session_id = ? AND s.expires_at > ?
        """, (session_id, now))
        row = cursor.fetchone()
        return dict(row) if row else None

def delete_user_session(session_id):
    with get_db() as conn:
        cursor = conn.cursor()
        cursor.execute("DELETE FROM sessions WHERE session_id = ?", (session_id,))
        conn.commit()

def save_uploaded_file(filename, original_name, file_path, file_url, file_size, mime_type, entity_type=None, entity_id=None, user_id=None):
    with get_db() as conn:
        cursor = conn.cursor()
        cursor.execute("""
        INSERT INTO uploaded_files (
            filename, original_name, file_path, file_url, file_size, mime_type,
            related_entity, entity_id, uploaded_by_id
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
        """, (filename, original_name, file_path, file_url, file_size, mime_type, entity_type, entity_id, user_id))
        conn.commit()
        return cursor.lastrowid

def get_all_notifications():
    with get_db() as conn:
        cursor = conn.cursor()
        cursor.execute("SELECT id, type, message, time, read, related_project FROM notifications ORDER BY id ASC")
        return [dict(r) for r in cursor.fetchall()]
