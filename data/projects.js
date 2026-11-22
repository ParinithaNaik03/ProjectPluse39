// ProjectPulse - Demo Data Layer
// All data is for demonstration purposes only. Not verified government records.

window.PP_DATA = {
  projects: [
    {
      id: "PP-2024-001",
      name: "Central Waterfront Transit Hub",
      category: "transit",
      ward: 4,
      department: "Department of Transportation",
      contractor: "Skanska-Apex JV",
      status: "on_track",
      budget: 84200000,
      disbursed: 58400000,
      actualProgress: 68,
      plannedProgress: 65,
      startDate: "2023-03-15",
      deadline: "2025-11-30",
      estimatedCompletion: "2025-10-20",
      scheduleVariance: 3,
      milestones: [
        { id: 1, name: "Site Preparation", completed: true, date: "2023-05-01", completedDate: "2023-04-28" },
        { id: 2, name: "Foundation Work", completed: true, date: "2023-09-01", completedDate: "2023-08-30" },
        { id: 3, name: "Steel Framework", completed: true, date: "2024-02-01", completedDate: "2024-01-25" },
        { id: 4, name: "Platform Construction", completed: true, date: "2024-08-01", completedDate: "2024-07-20" },
        { id: 5, name: "MEP Systems Installation", completed: false, date: "2025-03-01", completedDate: null },
        { id: 6, name: "Final Fit-out & Commissioning", completed: false, date: "2025-10-01", completedDate: null }
      ],
      lat: 37.8044,
      lng: -122.2712,
      location: "Central Waterfront, Ward 4",
      description: "Multi-modal transit center with high-capacity ferry terminal, light rail connection, and urban plaza development.",
      inspections: [
        { date: "2024-10-15", inspector: "David Chen", type: "Structural", result: "Pass", notes: "Phase 4 concrete work meets spec." },
        { date: "2024-09-02", inspector: "Maria Lopez", type: "Safety", result: "Pass", notes: "All safety protocols in compliance." }
      ],
      progressHistory: [
        { month: "2024-05", actual: 35, planned: 33 },
        { month: "2024-06", actual: 42, planned: 40 },
        { month: "2024-07", actual: 50, planned: 48 },
        { month: "2024-08", actual: 56, planned: 55 },
        { month: "2024-09", actual: 61, planned: 59 },
        { month: "2024-10", actual: 68, planned: 65 }
      ],
      images: [],
      tags: ["high-priority", "phase-3"]
    },
    {
      id: "PP-2023-047",
      name: "Maple Parkway Viaduct Seismic Retrofit",
      category: "bridges",
      ward: 2,
      department: "Bridges & Safety Division",
      contractor: "Pacific Span Ltd.",
      status: "critical",
      budget: 127500000,
      disbursed: 89200000,
      actualProgress: 54,
      plannedProgress: 72,
      startDate: "2023-01-10",
      deadline: "2025-06-30",
      estimatedCompletion: "2025-10-15",
      scheduleVariance: -18,
      milestones: [
        { id: 1, name: "Engineering Assessment", completed: true, date: "2023-03-01", completedDate: "2023-02-28" },
        { id: 2, name: "Procurement & Permits", completed: true, date: "2023-07-01", completedDate: "2023-07-15" },
        { id: 3, name: "Foundation Strengthening", completed: true, date: "2024-01-01", completedDate: "2024-01-20" },
        { id: 4, name: "Pier Retrofit Phase 1", completed: false, date: "2024-08-01", completedDate: null },
        { id: 5, name: "Pier Retrofit Phase 2", completed: false, date: "2025-02-01", completedDate: null },
        { id: 6, name: "Deck & Bearing Replacement", completed: false, date: "2025-05-01", completedDate: null },
        { id: 7, name: "Load Testing & Sign-off", completed: false, date: "2025-06-01", completedDate: null }
      ],
      lat: 37.7749,
      lng: -122.4194,
      location: "Maple Parkway, Ward 2",
      description: "Critical seismic retrofit of 1.2km elevated viaduct. Includes pier strengthening, bearing replacement, and deck rehabilitation to current seismic standards.",
      inspections: [
        { date: "2024-10-10", inspector: "Robert Kim", type: "Structural", result: "Needs Attention", notes: "Pier Base 07 concrete pour on hold pending spec audit. Inspector signature missing for batch resilience testing." },
        { date: "2024-09-18", inspector: "Sarah Johnson", type: "Safety", result: "Pass", notes: "Worker safety protocols compliant." }
      ],
      progressHistory: [
        { month: "2024-05", actual: 38, planned: 55 },
        { month: "2024-06", actual: 42, planned: 60 },
        { month: "2024-07", actual: 46, planned: 64 },
        { month: "2024-08", actual: 50, planned: 67 },
        { month: "2024-09", actual: 52, planned: 70 },
        { month: "2024-10", actual: 54, planned: 72 }
      ],
      images: [],
      tags: ["critical-delay", "seismic"]
    },
    {
      id: "PP-2024-012",
      name: "East River Stormwater Facility",
      category: "water",
      ward: 7,
      department: "Water & Utilities",
      contractor: "HydroConstruct LLC",
      status: "under_review",
      budget: 43800000,
      disbursed: 28600000,
      actualProgress: 61,
      plannedProgress: 68,
      startDate: "2023-06-01",
      deadline: "2025-09-30",
      estimatedCompletion: "2025-11-15",
      scheduleVariance: -7,
      milestones: [
        { id: 1, name: "Environmental Assessment", completed: true, date: "2023-08-01", completedDate: "2023-07-28" },
        { id: 2, name: "Excavation & Grading", completed: true, date: "2024-01-01", completedDate: "2024-01-10" },
        { id: 3, name: "Drainage Infrastructure", completed: true, date: "2024-06-01", completedDate: "2024-06-20" },
        { id: 4, name: "Treatment Systems", completed: false, date: "2025-03-01", completedDate: null },
        { id: 5, name: "Landscaping & Completion", completed: false, date: "2025-09-01", completedDate: null }
      ],
      lat: 37.8099,
      lng: -122.2534,
      location: "East River Corridor, Ward 7",
      description: "Combined sewer overflow control and stormwater treatment facility with 2.4M gallon retention capacity.",
      inspections: [
        { date: "2024-10-05", inspector: "Amy Nguyen", type: "Environmental", result: "Pass", notes: "Runoff controls adequate." }
      ],
      progressHistory: [
        { month: "2024-05", actual: 45, planned: 50 },
        { month: "2024-06", actual: 52, planned: 55 },
        { month: "2024-07", actual: 56, planned: 60 },
        { month: "2024-08", actual: 58, planned: 63 },
        { month: "2024-09", actual: 60, planned: 66 },
        { month: "2024-10", actual: 61, planned: 68 }
      ],
      images: [],
      tags: ["water-infrastructure"]
    },
    {
      id: "PP-2024-023",
      name: "Southside Community Health Center",
      category: "public_facilities",
      ward: 9,
      department: "Public Health & Facilities",
      contractor: "MedBuild Partners",
      status: "on_track",
      budget: 31200000,
      disbursed: 18900000,
      actualProgress: 72,
      plannedProgress: 70,
      startDate: "2023-09-01",
      deadline: "2025-08-31",
      estimatedCompletion: "2025-07-15",
      scheduleVariance: 2,
      milestones: [
        { id: 1, name: "Permits & Design Approval", completed: true, date: "2023-11-01", completedDate: "2023-10-28" },
        { id: 2, name: "Foundation & Structure", completed: true, date: "2024-04-01", completedDate: "2024-03-25" },
        { id: 3, name: "MEP Rough-in", completed: true, date: "2024-09-01", completedDate: "2024-08-30" },
        { id: 4, name: "Interior Finishes", completed: false, date: "2025-03-01", completedDate: null },
        { id: 5, name: "Medical Equipment Install", completed: false, date: "2025-07-01", completedDate: null }
      ],
      lat: 37.7599,
      lng: -122.4477,
      location: "Southside District, Ward 9",
      description: "140,000 sq ft community health center with emergency clinic, primary care, mental health services, and community wellness facilities.",
      inspections: [
        { date: "2024-10-12", inspector: "James Wilson", type: "Structural", result: "Pass", notes: "All framing compliant with health facility standards." }
      ],
      progressHistory: [
        { month: "2024-05", actual: 50, planned: 48 },
        { month: "2024-06", actual: 56, planned: 54 },
        { month: "2024-07", actual: 62, planned: 60 },
        { month: "2024-08", actual: 66, planned: 64 },
        { month: "2024-09", actual: 69, planned: 67 },
        { month: "2024-10", actual: 72, planned: 70 }
      ],
      images: [],
      tags: ["health", "community"]
    },
    {
      id: "PP-2024-031",
      name: "Westside Stormwater Treatment",
      category: "water",
      ward: 5,
      department: "Water & Utilities",
      contractor: "AquaTech Solutions",
      status: "on_track",
      budget: 22400000,
      disbursed: 14100000,
      actualProgress: 45,
      plannedProgress: 42,
      startDate: "2024-01-15",
      deadline: "2025-12-31",
      estimatedCompletion: "2025-11-20",
      scheduleVariance: 3,
      milestones: [
        { id: 1, name: "Site Survey & Permits", completed: true, date: "2024-03-01", completedDate: "2024-02-28" },
        { id: 2, name: "Excavation Phase 1", completed: true, date: "2024-07-01", completedDate: "2024-06-25" },
        { id: 3, name: "Infrastructure Installation", completed: false, date: "2025-02-01", completedDate: null },
        { id: 4, name: "Treatment System", completed: false, date: "2025-08-01", completedDate: null },
        { id: 5, name: "Testing & Commissioning", completed: false, date: "2025-12-01", completedDate: null }
      ],
      lat: 37.7849,
      lng: -122.4994,
      location: "Westside District, Ward 5",
      description: "New stormwater treatment plant with green infrastructure components including bioswales and permeable paving.",
      inspections: [],
      progressHistory: [
        { month: "2024-05", actual: 20, planned: 18 },
        { month: "2024-06", actual: 28, planned: 25 },
        { month: "2024-07", actual: 33, planned: 30 },
        { month: "2024-08", actual: 38, planned: 35 },
        { month: "2024-09", actual: 42, planned: 39 },
        { month: "2024-10", actual: 45, planned: 42 }
      ],
      images: [],
      tags: ["water-infrastructure", "green"]
    },
    {
      id: "PP-2022-089",
      name: "North Greenline Light Rail Extension",
      category: "transit",
      ward: 1,
      department: "Metropolitan Transit Authority",
      contractor: "RailBuild Consortium",
      status: "critical",
      budget: 285000000,
      disbursed: 198200000,
      actualProgress: 63,
      plannedProgress: 80,
      startDate: "2022-06-01",
      deadline: "2025-03-31",
      estimatedCompletion: "2026-02-15",
      scheduleVariance: -17,
      milestones: [
        { id: 1, name: "Environmental Impact Study", completed: true, date: "2022-09-01", completedDate: "2022-08-30" },
        { id: 2, name: "Right-of-Way Acquisition", completed: true, date: "2023-03-01", completedDate: "2023-04-15" },
        { id: 3, name: "Track Bed Preparation", completed: true, date: "2023-10-01", completedDate: "2023-11-01" },
        { id: 4, name: "Track Laying Phase 1", completed: true, date: "2024-04-01", completedDate: "2024-04-10" },
        { id: 5, name: "Track Laying Phase 2", completed: false, date: "2024-09-01", completedDate: null },
        { id: 6, name: "Station Construction", completed: false, date: "2025-01-01", completedDate: null },
        { id: 7, name: "Electrification Systems", completed: false, date: "2025-02-01", completedDate: null },
        { id: 8, name: "Testing & Integration", completed: false, date: "2025-03-01", completedDate: null }
      ],
      lat: 37.8294,
      lng: -122.2912,
      location: "North Corridor, Ward 1",
      description: "14km light rail extension connecting North District to downtown with 6 new stations, park-and-ride facilities, and transit-oriented development zones.",
      inspections: [
        { date: "2024-10-08", inspector: "Carlos Rivera", type: "Track Alignment", result: "Needs Attention", notes: "Track alignment deviation of 3mm at Junction B-14. Requires recalibration." },
        { date: "2024-09-25", inspector: "Lisa Park", type: "Safety", result: "Pass", notes: "Worker safety standards maintained." }
      ],
      progressHistory: [
        { month: "2024-05", actual: 55, planned: 70 },
        { month: "2024-06", actual: 57, planned: 73 },
        { month: "2024-07", actual: 59, planned: 75 },
        { month: "2024-08", actual: 61, planned: 77 },
        { month: "2024-09", actual: 62, planned: 79 },
        { month: "2024-10", actual: 63, planned: 80 }
      ],
      images: [],
      tags: ["critical-delay", "major-infrastructure"]
    },
    {
      id: "PP-2024-045",
      name: "Harbor View Park Renovation",
      category: "parks",
      ward: 6,
      department: "Parks & Recreation",
      contractor: "GreenSpace Developers",
      status: "on_track",
      budget: 8600000,
      disbursed: 3200000,
      actualProgress: 38,
      plannedProgress: 35,
      startDate: "2024-04-01",
      deadline: "2025-10-31",
      estimatedCompletion: "2025-09-15",
      scheduleVariance: 3,
      milestones: [
        { id: 1, name: "Design Finalization", completed: true, date: "2024-05-01", completedDate: "2024-04-28" },
        { id: 2, name: "Site Clearing", completed: true, date: "2024-07-01", completedDate: "2024-06-30" },
        { id: 3, name: "Hardscape Installation", completed: false, date: "2025-01-01", completedDate: null },
        { id: 4, name: "Landscaping", completed: false, date: "2025-07-01", completedDate: null },
        { id: 5, name: "Amenities & Completion", completed: false, date: "2025-10-01", completedDate: null }
      ],
      lat: 37.7949,
      lng: -122.3912,
      location: "Harbor View, Ward 6",
      description: "Complete renovation of 12-acre harbor view park with new playground, amphitheater, waterfront promenade, and community garden.",
      inspections: [],
      progressHistory: [
        { month: "2024-07", actual: 10, planned: 8 },
        { month: "2024-08", actual: 20, planned: 18 },
        { month: "2024-09", actual: 30, planned: 27 },
        { month: "2024-10", actual: 38, planned: 35 }
      ],
      images: [],
      tags: ["parks", "community"]
    },
    {
      id: "PP-2024-058",
      name: "Downtown Road Resurfacing Phase 3",
      category: "bridges",
      ward: 3,
      department: "Public Works",
      contractor: "Metro Paving Corp",
      status: "under_review",
      budget: 15300000,
      disbursed: 9800000,
      actualProgress: 55,
      plannedProgress: 65,
      startDate: "2024-02-01",
      deadline: "2025-06-30",
      estimatedCompletion: "2025-08-01",
      scheduleVariance: -10,
      milestones: [
        { id: 1, name: "Traffic Study & Planning", completed: true, date: "2024-03-01", completedDate: "2024-02-25" },
        { id: 2, name: "Zone A Resurfacing", completed: true, date: "2024-06-01", completedDate: "2024-06-15" },
        { id: 3, name: "Zone B Resurfacing", completed: false, date: "2024-10-01", completedDate: null },
        { id: 4, name: "Zone C Resurfacing", completed: false, date: "2025-03-01", completedDate: null },
        { id: 5, name: "Line Marking & Completion", completed: false, date: "2025-06-01", completedDate: null }
      ],
      lat: 37.7749,
      lng: -122.4194,
      location: "Downtown District, Ward 3",
      description: "Phase 3 road resurfacing covering 28 blocks of downtown core streets with new asphalt, ADA curb ramps, and improved drainage.",
      inspections: [
        { date: "2024-10-01", inspector: "Tom Bradley", type: "Pavement Quality", result: "Needs Attention", notes: "Zone B contractor behind schedule. Material delivery delayed 10 days." }
      ],
      progressHistory: [
        { month: "2024-05", actual: 30, planned: 38 },
        { month: "2024-06", actual: 40, planned: 48 },
        { month: "2024-07", actual: 44, planned: 54 },
        { month: "2024-08", actual: 48, planned: 58 },
        { month: "2024-09", actual: 52, planned: 62 },
        { month: "2024-10", actual: 55, planned: 65 }
      ],
      images: [],
      tags: ["roads"]
    }
  ],

  citizenReports: [
    {
      id: "CR-2024-1891",
      title: "Pothole expansion near East Pier 4",
      category: "road_damage",
      status: "under_review",
      priority: "high",
      location: "East Pier Sector, Ward 7",
      lat: 37.8099,
      lng: -122.2634,
      description: "Heavy transport traffic accelerating asphalt subsidence along maritime access corridor. Multiple large potholes forming at junction of Pier Road and Industrial Ave.",
      submittedDate: "2024-10-18",
      submittedBy: "Anonymous Citizen",
      contact: "",
      upvotes: 14,
      photos: 2,
      assignedDepartment: "Public Works",
      internalRemarks: "Field crew dispatched for assessment 10/20.",
      resolutionHistory: []
    },
    {
      id: "CR-2024-1856",
      title: "Street lighting outage on Maple Ave block 4",
      category: "infrastructure_safety",
      status: "assigned",
      priority: "medium",
      location: "Maple Avenue, Ward 2",
      lat: 37.7749,
      lng: -122.4094,
      description: "6 consecutive streetlights not functioning for 3 days. Safety hazard for pedestrians at night.",
      submittedDate: "2024-10-15",
      submittedBy: "John D.",
      contact: "john.d@email.com",
      upvotes: 8,
      photos: 1,
      assignedDepartment: "Electrical Services",
      internalRemarks: "",
      resolutionHistory: []
    },
    {
      id: "CR-2024-1823",
      title: "Water main leak – North Greenline construction zone",
      category: "water_supply",
      status: "critical",
      priority: "critical",
      location: "North Corridor, Ward 1",
      lat: 37.8294,
      lng: -122.2912,
      description: "Visible water main leak at construction zone boundary. Water pooling on road surface. Likely caused by construction vibration.",
      submittedDate: "2024-10-12",
      submittedBy: "Resident Association",
      contact: "ward1res@email.com",
      upvotes: 31,
      photos: 4,
      assignedDepartment: "Water & Utilities",
      internalRemarks: "Emergency repair team dispatched.",
      resolutionHistory: [
        { date: "2024-10-13", action: "Emergency assessment conducted", actor: "Water Dept." }
      ]
    },
    {
      id: "CR-2024-1799",
      title: "Playground equipment damage – Southside Park",
      category: "public_facility",
      status: "resolved",
      priority: "medium",
      location: "Southside Park, Ward 9",
      lat: 37.7599,
      lng: -122.4477,
      description: "Swing set chains broken and slide has sharp edges. Safety risk for children.",
      submittedDate: "2024-10-05",
      submittedBy: "Parent Group",
      contact: "",
      upvotes: 22,
      photos: 3,
      assignedDepartment: "Parks & Recreation",
      internalRemarks: "Equipment replaced and inspected.",
      resolutionHistory: [
        { date: "2024-10-08", action: "Work order issued", actor: "Parks Dept." },
        { date: "2024-10-14", action: "Equipment replaced", actor: "Maintenance Crew" },
        { date: "2024-10-15", action: "Safety inspection completed – PASS", actor: "Inspector" }
      ]
    },
    {
      id: "CR-2024-1764",
      title: "Dust and noise pollution from construction – Ward 4",
      category: "public_facility",
      status: "under_review",
      priority: "low",
      location: "Waterfront District, Ward 4",
      lat: 37.8044,
      lng: -122.2812,
      description: "Excessive dust from Central Waterfront Transit Hub construction affecting nearby residences. Noise levels exceeding permitted hours.",
      submittedDate: "2024-09-28",
      submittedBy: "Neighborhood Watch",
      contact: "ward4nw@email.com",
      upvotes: 11,
      photos: 2,
      assignedDepartment: "Department of Transportation",
      internalRemarks: "Contractor notified. Mitigation measures requested.",
      resolutionHistory: []
    }
  ],

  users: [
    { id: 1, name: "Commissioner Sarah Blake", role: "admin", email: "s.blake@citygov.org", ward: null, avatar: "SB" },
    { id: 2, name: "Inspector David Chen", role: "field_inspector", email: "d.chen@citygov.org", ward: 4, avatar: "DC" },
    { id: 3, name: "Project Manager Maria Lopez", role: "contractor", email: "m.lopez@skanska-apex.com", ward: null, avatar: "ML" },
    { id: 4, name: "Citizen User", role: "citizen", email: "citizen@email.com", ward: 4, avatar: "CU" }
  ],

  notifications: [
    { id: 1, type: "critical", message: "Maple Parkway Viaduct – 18 day delay detected", time: "2h ago", read: false },
    { id: 2, type: "warning", message: "North Greenline Rail – Budget utilization at 69.5%", time: "4h ago", read: false },
    { id: 3, type: "info", message: "New citizen report: Water leak Ward 1 (Critical priority)", time: "6h ago", read: false },
    { id: 4, type: "success", message: "Southside Health Center milestone 3 completed", time: "1d ago", read: true },
    { id: 5, type: "info", message: "Monthly project review scheduled for Nov 1, 2024", time: "2d ago", read: true }
  ],

  departments: [
    "Department of Transportation",
    "Bridges & Safety Division",
    "Water & Utilities",
    "Public Health & Facilities",
    "Metropolitan Transit Authority",
    "Parks & Recreation",
    "Public Works",
    "Electrical Services"
  ]
};
