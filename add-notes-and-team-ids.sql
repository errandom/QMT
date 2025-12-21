-- Add notes column and team_ids to events table
-- This allows separate description/title and notes fields
-- And supports multiple teams per event

-- Add notes column
IF NOT EXISTS (SELECT * FROM sys.columns WHERE object_id = OBJECT_ID(N'events') AND name = 'notes')
BEGIN
    ALTER TABLE events ADD notes NVARCHAR(1000) NULL;
    PRINT 'Added notes column to events table';
END

-- Add team_ids column to store multiple team IDs as comma-separated values
IF NOT EXISTS (SELECT * FROM sys.columns WHERE object_id = OBJECT_ID(N'events') AND name = 'team_ids')
BEGIN
    ALTER TABLE events ADD team_ids NVARCHAR(255) NULL;
    PRINT 'Added team_ids column to events table';
    
    -- Migrate existing team_id values to team_ids
    UPDATE events 
    SET team_ids = CAST(team_id AS NVARCHAR(255))
    WHERE team_id IS NOT NULL;
    PRINT 'Migrated existing team_id values to team_ids';
END

-- Add recurring_days column to store which days of week event recurs on (comma-separated: 1,2,3 etc)
IF NOT EXISTS (SELECT * FROM sys.columns WHERE object_id = OBJECT_ID(N'events') AND name = 'recurring_days')
BEGIN
    ALTER TABLE events ADD recurring_days NVARCHAR(50) NULL;
    PRINT 'Added recurring_days column to events table';
END

-- Add recurring_end_date column to store when recurring events should stop
IF NOT EXISTS (SELECT * FROM sys.columns WHERE object_id = OBJECT_ID(N'events') AND name = 'recurring_end_date')
BEGIN
    ALTER TABLE events ADD recurring_end_date DATE NULL;
    PRINT 'Added recurring_end_date column to events table';
END

GO
