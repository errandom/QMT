-- Optional migration script to remove the coaches column from teams table
-- Run this ONLY AFTER verifying that the individual contact fields are working correctly
-- This script is safe to run multiple times (idempotent)

PRINT 'Checking for coaches column in teams table...';

-- Check if the column exists before trying to drop it
IF EXISTS (SELECT * FROM sys.columns WHERE object_id = OBJECT_ID('teams') AND name = 'coaches')
BEGIN
    PRINT 'Dropping coaches column from teams table...';
    ALTER TABLE teams DROP COLUMN coaches;
    PRINT 'Successfully removed coaches column!';
END
ELSE
BEGIN
    PRINT 'coaches column does not exist (already removed or never created)';
END

PRINT '';
PRINT '==============================================';
PRINT 'Migration completed!';
PRINT '==============================================';
PRINT '';
PRINT 'NOTE: The individual contact fields are now being used:';
PRINT '  - head_coach_first_name';
PRINT '  - head_coach_last_name';
PRINT '  - head_coach_email';
PRINT '  - head_coach_phone';
PRINT '  - team_manager_first_name';
PRINT '  - team_manager_last_name';
PRINT '  - team_manager_email';
PRINT '  - team_manager_phone';
