-- Spond Integration Database Migration
-- Adds tables and columns needed for Spond.com integration

-- =====================================================
-- 1. Spond Configuration Table
-- =====================================================
-- Stores Spond API credentials and sync settings
IF NOT EXISTS (SELECT * FROM sysobjects WHERE name='spond_config' AND xtype='U')
BEGIN
    CREATE TABLE spond_config (
        id INT PRIMARY KEY IDENTITY(1,1),
        username NVARCHAR(255) NOT NULL,
        password NVARCHAR(255) NOT NULL, -- TODO: Encrypt in production
        auto_sync BIT DEFAULT 0,
        sync_interval_minutes INT DEFAULT 60,
        is_active BIT DEFAULT 1,
        last_sync DATETIME NULL,
        created_at DATETIME DEFAULT GETDATE(),
        updated_at DATETIME DEFAULT GETDATE()
    );
    PRINT 'Created spond_config table';
END
GO

-- =====================================================
-- 2. Add Spond columns to Teams table
-- =====================================================
-- Link local teams to Spond groups
IF NOT EXISTS (SELECT * FROM sys.columns WHERE object_id = OBJECT_ID('teams') AND name = 'spond_group_id')
BEGIN
    ALTER TABLE teams ADD spond_group_id NVARCHAR(100) NULL;
    PRINT 'Added spond_group_id column to teams table';
END
GO

IF NOT EXISTS (SELECT * FROM sys.columns WHERE object_id = OBJECT_ID('teams') AND name = 'spond_data')
BEGIN
    ALTER TABLE teams ADD spond_data NVARCHAR(MAX) NULL;
    PRINT 'Added spond_data column to teams table';
END
GO

-- =====================================================
-- 3. Add Spond columns to Events table
-- =====================================================
-- Link local events to Spond events
IF NOT EXISTS (SELECT * FROM sys.columns WHERE object_id = OBJECT_ID('events') AND name = 'spond_id')
BEGIN
    ALTER TABLE events ADD spond_id NVARCHAR(100) NULL;
    PRINT 'Added spond_id column to events table';
END
GO

IF NOT EXISTS (SELECT * FROM sys.columns WHERE object_id = OBJECT_ID('events') AND name = 'spond_group_id')
BEGIN
    ALTER TABLE events ADD spond_group_id NVARCHAR(100) NULL;
    PRINT 'Added spond_group_id column to events table';
END
GO

IF NOT EXISTS (SELECT * FROM sys.columns WHERE object_id = OBJECT_ID('events') AND name = 'spond_data')
BEGIN
    ALTER TABLE events ADD spond_data NVARCHAR(MAX) NULL;
    PRINT 'Added spond_data column to events table';
END
GO

-- Add name column to events table (for storing Spond event heading)
IF NOT EXISTS (SELECT * FROM sys.columns WHERE object_id = OBJECT_ID('events') AND name = 'name')
BEGIN
    ALTER TABLE events ADD name NVARCHAR(255) NULL;
    PRINT 'Added name column to events table';
END
GO

-- =====================================================
-- 3b. Add Attendance columns to Events table
-- =====================================================
-- Store attendance counts from Spond
IF NOT EXISTS (SELECT * FROM sys.columns WHERE object_id = OBJECT_ID('events') AND name = 'attendance_accepted')
BEGIN
    ALTER TABLE events ADD attendance_accepted INT DEFAULT 0;
    PRINT 'Added attendance_accepted column to events table';
END
GO

IF NOT EXISTS (SELECT * FROM sys.columns WHERE object_id = OBJECT_ID('events') AND name = 'attendance_declined')
BEGIN
    ALTER TABLE events ADD attendance_declined INT DEFAULT 0;
    PRINT 'Added attendance_declined column to events table';
END
GO

IF NOT EXISTS (SELECT * FROM sys.columns WHERE object_id = OBJECT_ID('events') AND name = 'attendance_unanswered')
BEGIN
    ALTER TABLE events ADD attendance_unanswered INT DEFAULT 0;
    PRINT 'Added attendance_unanswered column to events table';
END
GO

IF NOT EXISTS (SELECT * FROM sys.columns WHERE object_id = OBJECT_ID('events') AND name = 'attendance_waiting')
BEGIN
    ALTER TABLE events ADD attendance_waiting INT DEFAULT 0;
    PRINT 'Added attendance_waiting column to events table';
END
GO

IF NOT EXISTS (SELECT * FROM sys.columns WHERE object_id = OBJECT_ID('events') AND name = 'attendance_data')
BEGIN
    ALTER TABLE events ADD attendance_data NVARCHAR(MAX) NULL;
    PRINT 'Added attendance_data column to events table (stores detailed member responses)';
END
GO

IF NOT EXISTS (SELECT * FROM sys.columns WHERE object_id = OBJECT_ID('events') AND name = 'attendance_last_sync')
BEGIN
    ALTER TABLE events ADD attendance_last_sync DATETIME NULL;
    PRINT 'Added attendance_last_sync column to events table';
END
GO

-- =====================================================
-- 4. Spond Sync Log Table
-- =====================================================
-- Track sync history for debugging and auditing
IF NOT EXISTS (SELECT * FROM sysobjects WHERE name='spond_sync_log' AND xtype='U')
BEGIN
    CREATE TABLE spond_sync_log (
        id INT PRIMARY KEY IDENTITY(1,1),
        sync_type NVARCHAR(50) NOT NULL, -- 'full', 'events', 'groups', 'export'
        direction NVARCHAR(20) NOT NULL, -- 'import', 'export'
        status NVARCHAR(20) NOT NULL, -- 'success', 'partial', 'failed'
        items_processed INT DEFAULT 0,
        items_imported INT DEFAULT 0,
        items_updated INT DEFAULT 0,
        items_failed INT DEFAULT 0,
        error_message NVARCHAR(MAX) NULL,
        started_at DATETIME NOT NULL,
        completed_at DATETIME NULL,
        created_at DATETIME DEFAULT GETDATE()
    );
    PRINT 'Created spond_sync_log table';
END
GO

-- =====================================================
-- 5. Spond Group Mappings Table (optional advanced mapping)
-- =====================================================
-- For complex scenarios where one Spond group maps to multiple teams
IF NOT EXISTS (SELECT * FROM sysobjects WHERE name='spond_group_mappings' AND xtype='U')
BEGIN
    CREATE TABLE spond_group_mappings (
        id INT PRIMARY KEY IDENTITY(1,1),
        spond_group_id NVARCHAR(100) NOT NULL,
        spond_group_name NVARCHAR(255) NULL,
        team_id INT NULL,
        sync_events BIT DEFAULT 1,
        sync_members BIT DEFAULT 0,
        is_active BIT DEFAULT 1,
        created_at DATETIME DEFAULT GETDATE(),
        updated_at DATETIME DEFAULT GETDATE(),
        CONSTRAINT FK_spond_mappings_teams FOREIGN KEY (team_id) REFERENCES teams(id) ON DELETE SET NULL
    );
    PRINT 'Created spond_group_mappings table';
END
GO

-- =====================================================
-- 6. Create Indexes for Spond columns
-- =====================================================
IF NOT EXISTS (SELECT * FROM sys.indexes WHERE name = 'idx_teams_spond_group_id')
BEGIN
    CREATE INDEX idx_teams_spond_group_id ON teams(spond_group_id);
    PRINT 'Created index on teams.spond_group_id';
END
GO

IF NOT EXISTS (SELECT * FROM sys.indexes WHERE name = 'idx_events_spond_id')
BEGIN
    CREATE INDEX idx_events_spond_id ON events(spond_id);
    PRINT 'Created index on events.spond_id';
END
GO

IF NOT EXISTS (SELECT * FROM sys.indexes WHERE name = 'idx_events_spond_group_id')
BEGIN
    CREATE INDEX idx_events_spond_group_id ON events(spond_group_id);
    PRINT 'Created index on events.spond_group_id';
END
GO

IF NOT EXISTS (SELECT * FROM sys.indexes WHERE name = 'idx_spond_sync_log_type')
BEGIN
    CREATE INDEX idx_spond_sync_log_type ON spond_sync_log(sync_type, status);
    PRINT 'Created index on spond_sync_log';
END
GO

-- =====================================================
-- 7. Event Participants Table (Attendance Tracking)
-- =====================================================
-- Store individual attendance responses from Spond
IF NOT EXISTS (SELECT * FROM sysobjects WHERE name='event_participants' AND xtype='U')
BEGIN
    CREATE TABLE event_participants (
        id INT PRIMARY KEY IDENTITY(1,1),
        event_id INT NOT NULL,
        spond_member_id NVARCHAR(100) NOT NULL,
        first_name NVARCHAR(255),
        last_name NVARCHAR(255),
        email NVARCHAR(255),
        response NVARCHAR(50) NOT NULL CHECK (response IN ('accepted', 'declined', 'unanswered', 'waiting', 'unconfirmed')),
        response_time DATETIME NULL,
        is_organizer BIT DEFAULT 0,
        created_at DATETIME DEFAULT GETDATE(),
        updated_at DATETIME DEFAULT GETDATE(),
        CONSTRAINT FK_event_participants_events FOREIGN KEY (event_id) REFERENCES events(id) ON DELETE CASCADE
    );
    PRINT 'Created event_participants table';

    CREATE INDEX idx_event_participants_event_id ON event_participants(event_id);
    CREATE INDEX idx_event_participants_response ON event_participants(response);
    CREATE UNIQUE INDEX idx_event_participants_unique ON event_participants(event_id, spond_member_id);
END
GO

PRINT 'Spond integration migration completed successfully!';
