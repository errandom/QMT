IF OBJECT_ID('dbo.users', 'U') IS NULL
CREATE TABLE dbo.users (
  id int IDENTITY PRIMARY KEY, username nvarchar(255) NOT NULL UNIQUE,
  password_hash nvarchar(255) NOT NULL,
  role nvarchar(50) NOT NULL CHECK (role IN ('admin', 'mgmt', 'user')),
  email nvarchar(255), full_name nvarchar(255), is_active bit NOT NULL DEFAULT 1,
  created_at datetime2 NOT NULL DEFAULT SYSUTCDATETIME(), updated_at datetime2 NOT NULL DEFAULT SYSUTCDATETIME()
);
GO
IF OBJECT_ID('dbo.teams', 'U') IS NULL
CREATE TABLE dbo.teams (
  id int IDENTITY PRIMARY KEY, name nvarchar(255) NOT NULL,
  sport nvarchar(50) NOT NULL CHECK (sport IN ('Tackle Football', 'Flag Football')),
  age_group nvarchar(50), coaches nvarchar(500),
  head_coach_first_name nvarchar(255), head_coach_last_name nvarchar(255),
  head_coach_email nvarchar(255), head_coach_phone nvarchar(50),
  team_manager_first_name nvarchar(255), team_manager_last_name nvarchar(255),
  team_manager_email nvarchar(255), team_manager_phone nvarchar(50),
  active bit NOT NULL DEFAULT 1,
  created_at datetime2 NOT NULL DEFAULT SYSUTCDATETIME(), updated_at datetime2 NOT NULL DEFAULT SYSUTCDATETIME()
);
GO
IF OBJECT_ID('dbo.sites', 'U') IS NULL
CREATE TABLE dbo.sites (
  id int IDENTITY PRIMARY KEY, name nvarchar(255) NOT NULL,
  address nvarchar(500), city nvarchar(255), zip_code nvarchar(20),
  latitude float, longitude float, contact_first_name nvarchar(255), contact_last_name nvarchar(255),
  contact_phone nvarchar(50), contact_email nvarchar(255),
  is_sports_facility bit NOT NULL DEFAULT 1, amenities nvarchar(1000), active bit NOT NULL DEFAULT 1,
  created_at datetime2 NOT NULL DEFAULT SYSUTCDATETIME(), updated_at datetime2 NOT NULL DEFAULT SYSUTCDATETIME()
);
GO
IF OBJECT_ID('dbo.fields', 'U') IS NULL
CREATE TABLE dbo.fields (
  id int IDENTITY PRIMARY KEY, site_id int NOT NULL REFERENCES dbo.sites(id),
  name nvarchar(255) NOT NULL, field_type nvarchar(50), surface_type nvarchar(50),
  location_type nvarchar(50) NOT NULL DEFAULT 'field', has_lights bit NOT NULL DEFAULT 0,
  capacity int, active bit NOT NULL DEFAULT 1,
  created_at datetime2 NOT NULL DEFAULT SYSUTCDATETIME(), updated_at datetime2 NOT NULL DEFAULT SYSUTCDATETIME()
);
GO
IF OBJECT_ID('dbo.events', 'U') IS NULL
CREATE TABLE dbo.events (
  id int IDENTITY PRIMARY KEY, team_id int REFERENCES dbo.teams(id), field_id int REFERENCES dbo.fields(id),
  event_type nvarchar(50) NOT NULL CHECK (event_type IN ('Practice', 'Game', 'Meeting', 'Other')),
  start_time datetime2 NOT NULL, end_time datetime2 NOT NULL,
  description nvarchar(1000), status nvarchar(50) NOT NULL DEFAULT 'Planned'
    CHECK (status IN ('Planned', 'Confirmed', 'Cancelled', 'Completed')),
  created_at datetime2 NOT NULL DEFAULT SYSUTCDATETIME(), updated_at datetime2 NOT NULL DEFAULT SYSUTCDATETIME()
);
GO
IF OBJECT_ID('dbo.equipment', 'U') IS NULL
CREATE TABLE dbo.equipment (
  id int IDENTITY PRIMARY KEY, name nvarchar(255) NOT NULL, category nvarchar(100),
  quantity int NOT NULL DEFAULT 1, condition nvarchar(50) DEFAULT 'good', location nvarchar(255),
  created_at datetime2 NOT NULL DEFAULT SYSUTCDATETIME(), updated_at datetime2 NOT NULL DEFAULT SYSUTCDATETIME()
);
GO
IF OBJECT_ID('dbo.requests', 'U') IS NULL
CREATE TABLE dbo.requests (
  id int IDENTITY PRIMARY KEY, request_type nvarchar(50) NOT NULL
    CHECK (request_type IN ('facility', 'equipment', 'cancellation')),
  requestor_name nvarchar(255) NOT NULL, requestor_phone nvarchar(50), requestor_email nvarchar(255),
  team_id int REFERENCES dbo.teams(id), field_id int REFERENCES dbo.fields(id),
  event_type nvarchar(50), requested_date date, requested_time time, duration int,
  description nvarchar(1000), status nvarchar(50) NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'approved', 'denied', 'completed')), admin_notes nvarchar(1000),
  created_at datetime2 NOT NULL DEFAULT SYSUTCDATETIME(), updated_at datetime2 NOT NULL DEFAULT SYSUTCDATETIME()
);
GO
IF OBJECT_ID('dbo.user_settings', 'U') IS NULL
CREATE TABLE dbo.user_settings (
  user_id int NOT NULL REFERENCES dbo.users(id) ON DELETE CASCADE,
  setting_key nvarchar(255) NOT NULL, setting_value nvarchar(max) NOT NULL,
  updated_at datetime2 NOT NULL DEFAULT SYSUTCDATETIME(),
  PRIMARY KEY (user_id, setting_key)
);
