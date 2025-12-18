-- Azure SQL Database Schema for Renegades Sports Management
-- Run this script in your Azure SQL Database to create all required tables

-- Drop existing tables if needed (careful in production!)
-- DROP TABLE IF EXISTS requests;
-- DROP TABLE IF EXISTS events;
-- DROP TABLE IF EXISTS equipment;
-- DROP TABLE IF EXISTS fields;
-- DROP TABLE IF EXISTS sites;
-- DROP TABLE IF EXISTS teams;
-- DROP TABLE IF EXISTS users;

-- Users Table (for authentication)
CREATE TABLE users (
  id INT PRIMARY KEY IDENTITY(1,1),
  username NVARCHAR(255) NOT NULL UNIQUE,
  password_hash NVARCHAR(255) NOT NULL,
  role NVARCHAR(50) NOT NULL CHECK (role IN ('admin', 'mgmt', 'user')),
  email NVARCHAR(255),
  full_name NVARCHAR(255),
  is_active BIT DEFAULT 1,
  created_at DATETIME DEFAULT GETDATE(),
  updated_at DATETIME DEFAULT GETDATE()
);

-- Teams Table
CREATE TABLE teams (
  id INT PRIMARY KEY IDENTITY(1,1),
  name NVARCHAR(255) NOT NULL,
  sport NVARCHAR(50) NOT NULL CHECK (sport IN ('Tackle Football', 'Flag Football')),
  age_group NVARCHAR(50),
  coaches NVARCHAR(500),
  active BIT DEFAULT 1,
  created_at DATETIME DEFAULT GETDATE(),
  updated_at DATETIME DEFAULT GETDATE()
);

-- Sites Table
CREATE TABLE sites (
  id INT PRIMARY KEY IDENTITY(1,1),
  name NVARCHAR(255) NOT NULL,
  address NVARCHAR(500),
  city NVARCHAR(255),
  zip_code NVARCHAR(20),
  latitude FLOAT,
  longitude FLOAT,
  contact_first_name NVARCHAR(255),
  contact_last_name NVARCHAR(255),
  contact_phone NVARCHAR(50),
  contact_email NVARCHAR(255),
  is_sports_facility BIT DEFAULT 1,
  amenities NVARCHAR(1000),
  active BIT DEFAULT 1,
  created_at DATETIME DEFAULT GETDATE(),
  updated_at DATETIME DEFAULT GETDATE()
);

-- Fields Table
CREATE TABLE fields (
  id INT PRIMARY KEY IDENTITY(1,1),
  site_id INT NOT NULL,
  name NVARCHAR(255) NOT NULL,
  field_type NVARCHAR(50),
  surface_type NVARCHAR(50),
  created_at DATETIME DEFAULT GETDATE(),
  updated_at DATETIME DEFAULT GETDATE(),
  CONSTRAINT FK_fields_sites FOREIGN KEY (site_id) REFERENCES sites(id) ON DELETE CASCADE
);

-- Events Table
CREATE TABLE events (
  id INT PRIMARY KEY IDENTITY(1,1),
  team_id INT,
  field_id INT,
  event_type NVARCHAR(50) NOT NULL CHECK (event_type IN ('Practice', 'Game', 'Meeting', 'Other')),
  start_time DATETIME NOT NULL,
  end_time DATETIME NOT NULL,
  description NVARCHAR(1000),
  status NVARCHAR(50) DEFAULT 'scheduled' CHECK (status IN ('scheduled', 'cancelled', 'completed', 'postponed')),
  created_at DATETIME DEFAULT GETDATE(),
  updated_at DATETIME DEFAULT GETDATE(),
  CONSTRAINT FK_events_teams FOREIGN KEY (team_id) REFERENCES teams(id) ON DELETE SET NULL,
  CONSTRAINT FK_events_fields FOREIGN KEY (field_id) REFERENCES fields(id) ON DELETE SET NULL
);

-- Equipment Table
CREATE TABLE equipment (
  id INT PRIMARY KEY IDENTITY(1,1),
  name NVARCHAR(255) NOT NULL,
  category NVARCHAR(100),
  quantity INT DEFAULT 1,
  condition NVARCHAR(50) DEFAULT 'good' CHECK (condition IN ('excellent', 'good', 'fair', 'poor', 'damaged')),
  location NVARCHAR(255),
  created_at DATETIME DEFAULT GETDATE(),
  updated_at DATETIME DEFAULT GETDATE()
);

-- Requests Table (for facility and equipment requests)
CREATE TABLE requests (
  id INT PRIMARY KEY IDENTITY(1,1),
  request_type NVARCHAR(50) NOT NULL CHECK (request_type IN ('facility', 'equipment', 'cancellation')),
  requestor_name NVARCHAR(255) NOT NULL,
  requestor_phone NVARCHAR(50),
  requestor_email NVARCHAR(255),
  team_id INT,
  field_id INT,
  event_type NVARCHAR(50),
  requested_date DATE,
  requested_time TIME,
  duration INT,
  description NVARCHAR(1000),
  status NVARCHAR(50) DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'denied', 'completed')),
  admin_notes NVARCHAR(1000),
  created_at DATETIME DEFAULT GETDATE(),
  updated_at DATETIME DEFAULT GETDATE(),
  CONSTRAINT FK_requests_teams FOREIGN KEY (team_id) REFERENCES teams(id) ON DELETE SET NULL,
  CONSTRAINT FK_requests_fields FOREIGN KEY (field_id) REFERENCES fields(id) ON DELETE SET NULL
);

-- Create indexes for better query performance
CREATE INDEX idx_events_team_id ON events(team_id);
CREATE INDEX idx_events_field_id ON events(field_id);
CREATE INDEX idx_events_start_time ON events(start_time);
CREATE INDEX idx_events_status ON events(status);
CREATE INDEX idx_fields_site_id ON fields(site_id);
CREATE INDEX idx_requests_status ON requests(status);
CREATE INDEX idx_requests_type ON requests(request_type);
CREATE INDEX idx_teams_sport ON teams(sport);
CREATE INDEX idx_teams_active ON teams(active);
CREATE INDEX idx_users_username ON users(username);
CREATE INDEX idx_users_role ON users(role);

-- Insert sample data (optional)

-- Sample Users (password: 'Renegades!1982' hashed with bcrypt)
-- ⚠️ CRITICAL: Change these passwords immediately after first login!
INSERT INTO users (username, password_hash, role, email, full_name, is_active) VALUES
('QMTadmin', '$2a$10$vY8K4Z.VXN3H4g4V5FZx8.xqhJZLO5YkXZ6Z6Z3Z4Z5Z6Z7Z8Z9Z0', 'admin', 'admin@renegades.ch', 'Administrator', 1),
('manager1', '$2a$10$vY8K4Z.VXN3H4g4V5FZx8.xqhJZLO5YkXZ6Z6Z3Z4Z5Z6Z7Z8Z9Z0', 'mgmt', 'manager@renegades.ch', 'Team Manager', 1);

-- To generate proper password hashes, run this in your Node.js server:
-- const bcrypt = require('bcryptjs');
-- const hash = await bcrypt.hash('Renegades!1982', 10);
-- Then update the password_hash values above with the real hash

-- Sample Teams
INSERT INTO teams (name, sport, age_group, coaches, active) VALUES
('Renegades Seniors', 'Tackle Football', 'Adult', 'John Smith, Mike Johnson', 1),
('Renegades U19', 'Tackle Football', 'U19', 'Sarah Williams', 1),
('Renegades Youth', 'Flag Football', 'U12', 'Tom Brown', 1),
('Renegades Juniors', 'Flag Football', 'U15', 'Lisa Davis', 1);

-- Sample Sites
INSERT INTO sites (name, address, amenities) VALUES
('Sportanlage Heerenschürli', 'Heerenschürlistrasse 58, 8051 Zürich', 'Parking, Restrooms, Lights'),
('Sportplatz Buchlern', 'Buchlernstrasse 20, 8057 Zürich', 'Parking, Changing Rooms'),
('Sportanlage Fronwald', 'Fronwaldstrasse 22, 8047 Zürich', 'Full Facilities, Parking');

-- Sample Fields (assuming site IDs 1, 2, 3 from above)
INSERT INTO fields (site_id, name, field_type, surface_type) VALUES
(1, 'Field A', 'American Football', 'Artificial Turf'),
(1, 'Field B', 'American Football', 'Grass'),
(2, 'Main Field', 'American Football', 'Artificial Turf'),
(3, 'Practice Field 1', 'American Football', 'Grass'),
(3, 'Practice Field 2', 'American Football', 'Grass');

-- Sample Events (using team and field IDs from above)
INSERT INTO events (team_id, field_id, event_type, start_time, end_time, description, status) VALUES
(1, 1, 'Practice', DATEADD(day, 1, GETDATE()), DATEADD(hour, 2, DATEADD(day, 1, GETDATE())), 'Regular practice session', 'scheduled'),
(2, 2, 'Game', DATEADD(day, 3, GETDATE()), DATEADD(hour, 2.5, DATEADD(day, 3, GETDATE())), 'Home game vs. Basel Gladiators', 'scheduled'),
(3, 3, 'Practice', DATEADD(day, 2, GETDATE()), DATEADD(hour, 1.5, DATEADD(day, 2, GETDATE())), 'Youth training', 'scheduled');

-- Sample Equipment
INSERT INTO equipment (name, category, quantity, condition, location) VALUES
('Tackle Dummies', 'Training', 12, 'good', 'Storage Room A'),
('Footballs', 'Game Equipment', 25, 'excellent', 'Equipment Shed'),
('Cones', 'Training', 50, 'good', 'Storage Room A'),
('Flags', 'Flag Football', 30, 'good', 'Storage Room B'),
('First Aid Kit', 'Safety', 3, 'excellent', 'Coach Office');

-- Grant permissions (adjust as needed)
-- GRANT SELECT, INSERT, UPDATE, DELETE ON teams TO [YourAppUser];
-- GRANT SELECT, INSERT, UPDATE, DELETE ON sites TO [YourAppUser];
-- GRANT SELECT, INSERT, UPDATE, DELETE ON fields TO [YourAppUser];
-- GRANT SELECT, INSERT, UPDATE, DELETE ON events TO [YourAppUser];
-- GRANT SELECT, INSERT, UPDATE, DELETE ON equipment TO [YourAppUser];
-- GRANT SELECT, INSERT, UPDATE, DELETE ON requests TO [YourAppUser];
