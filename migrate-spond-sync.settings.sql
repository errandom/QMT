-- Spond Sync Settings Database Migration
-- Adds granular sync configuration per team/group
-- Allows specifying import/export direction and attributes to sync

-- =====================================================
-- 1. Spond Sync Settings Table
-- =====================================================
-- Stores per-team sync configuration
IF NOT EXISTS (SELECT * FROM sysobjects WHERE name='spond_sync_settings' AND xtype='U')
BEGIN
    CREATE TABLE spond_sync_settings (
        id INT PRIMARY KEY IDENTITY(1,1),
        team_id INT NOT NULL,
        spond_group_id NVARCHAR(100) NOT NULL,
        spond_group_name NVARCHAR(255) NULL,
        spond_parent_group_name NVARCHAR(255) NULL,
        is_subgroup BIT DEFAULT 0,
        
        -- Sync direction settings
        sync_events_import BIT DEFAULT 1,      -- Import events from Spond
        sync_events_export BIT DEFAULT 0,      -- Export events to Spond
        sync_attendance_import BIT DEFAULT 1,  -- Import attendance from Spond
        
        -- Attribute sync settings (which fields to sync)
        sync_event_title BIT DEFAULT 1,
        sync_event_description BIT DEFAULT 1,
        sync_event_time BIT DEFAULT 1,
        sync_event_location BIT DEFAULT 1,
        sync_event_type BIT DEFAULT 1,
        
        -- Last sync timestamps per direction
        last_import_sync DATETIME NULL,
        last_export_sync DATETIME NULL,
        last_attendance_sync DATETIME NULL,
        
        -- Enabled/disabled
        is_active BIT DEFAULT 1,
        
        created_at DATETIME DEFAULT GETDATE(),
        updated_at DATETIME DEFAULT GETDATE(),
        
        CONSTRAINT FK_spond_sync_team FOREIGN KEY (team_id) REFERENCES teams(id) ON DELETE CASCADE
    );
    
    CREATE INDEX IX_spond_sync_team_id ON spond_sync_settings(team_id);
    CREATE INDEX IX_spond_sync_group_id ON spond_sync_settings(spond_group_id);
    
    PRINT 'Created spond_sync_settings table';
END
GO

-- =====================================================
-- 2. Add import source tracking to teams
-- =====================================================
-- Track if a team was imported from Spond
IF NOT EXISTS (SELECT * FROM sys.columns WHERE object_id = OBJECT_ID('teams') AND name = 'imported_from_spond')
BEGIN
    ALTER TABLE teams ADD imported_from_spond BIT DEFAULT 0;
    PRINT 'Added imported_from_spond column to teams table';
END
GO

IF NOT EXISTS (SELECT * FROM sys.columns WHERE object_id = OBJECT_ID('teams') AND name = 'spond_import_date')
BEGIN
    ALTER TABLE teams ADD spond_import_date DATETIME NULL;
    PRINT 'Added spond_import_date column to teams table';
END
GO

-- =====================================================
-- 3. Migrate existing team links to sync settings
-- =====================================================
-- For teams that already have spond_group_id set, create sync settings
INSERT INTO spond_sync_settings (team_id, spond_group_id, sync_events_import, sync_attendance_import, is_active)
SELECT id, spond_group_id, 1, 1, 1
FROM teams 
WHERE spond_group_id IS NOT NULL
AND NOT EXISTS (
    SELECT 1 FROM spond_sync_settings ss WHERE ss.team_id = teams.id
);

PRINT 'Migrated existing team links to sync settings';
GO
