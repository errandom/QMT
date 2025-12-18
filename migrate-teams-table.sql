-- Migration script to add missing columns to teams table
-- Run this script against your database to add the new fields

-- Check if columns exist before adding them to avoid errors
IF NOT EXISTS (SELECT * FROM sys.columns WHERE object_id = OBJECT_ID('teams') AND name = 'head_coach_first_name')
BEGIN
    ALTER TABLE teams ADD head_coach_first_name NVARCHAR(255);
END

IF NOT EXISTS (SELECT * FROM sys.columns WHERE object_id = OBJECT_ID('teams') AND name = 'head_coach_last_name')
BEGIN
    ALTER TABLE teams ADD head_coach_last_name NVARCHAR(255);
END

IF NOT EXISTS (SELECT * FROM sys.columns WHERE object_id = OBJECT_ID('teams') AND name = 'head_coach_email')
BEGIN
    ALTER TABLE teams ADD head_coach_email NVARCHAR(255);
END

IF NOT EXISTS (SELECT * FROM sys.columns WHERE object_id = OBJECT_ID('teams') AND name = 'head_coach_phone')
BEGIN
    ALTER TABLE teams ADD head_coach_phone NVARCHAR(50);
END

IF NOT EXISTS (SELECT * FROM sys.columns WHERE object_id = OBJECT_ID('teams') AND name = 'team_manager_first_name')
BEGIN
    ALTER TABLE teams ADD team_manager_first_name NVARCHAR(255);
END

IF NOT EXISTS (SELECT * FROM sys.columns WHERE object_id = OBJECT_ID('teams') AND name = 'team_manager_last_name')
BEGIN
    ALTER TABLE teams ADD team_manager_last_name NVARCHAR(255);
END

IF NOT EXISTS (SELECT * FROM sys.columns WHERE object_id = OBJECT_ID('teams') AND name = 'team_manager_email')
BEGIN
    ALTER TABLE teams ADD team_manager_email NVARCHAR(255);
END

IF NOT EXISTS (SELECT * FROM sys.columns WHERE object_id = OBJECT_ID('teams') AND name = 'team_manager_phone')
BEGIN
    ALTER TABLE teams ADD team_manager_phone NVARCHAR(50);
END

PRINT 'Teams table migration completed successfully!';
