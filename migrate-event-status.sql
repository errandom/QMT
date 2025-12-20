-- Migration script to update event status values from lowercase to capitalized format
-- This aligns the database with the frontend expectations
-- Run this script on your Azure SQL Database

PRINT 'Starting event status migration...';
PRINT '';

-- First, update existing data to use the new capitalized format
PRINT 'Step 1: Updating existing event status values...';

UPDATE events
SET status = CASE 
    WHEN LOWER(status) = 'scheduled' THEN 'Planned'
    WHEN LOWER(status) = 'cancelled' THEN 'Cancelled'
    WHEN LOWER(status) = 'completed' THEN 'Completed'
    WHEN LOWER(status) = 'postponed' THEN 'Cancelled'
    ELSE status
END
WHERE LOWER(status) IN ('scheduled', 'cancelled', 'completed', 'postponed');

PRINT 'Data updated successfully!';
PRINT '';

-- Drop the old constraint
PRINT 'Step 2: Removing old status constraint...';

DECLARE @ConstraintName NVARCHAR(200);
SELECT @ConstraintName = name
FROM sys.check_constraints
WHERE parent_object_id = OBJECT_ID('events')
  AND definition LIKE '%scheduled%';

IF @ConstraintName IS NOT NULL
BEGIN
    DECLARE @SQL NVARCHAR(500) = 'ALTER TABLE events DROP CONSTRAINT ' + @ConstraintName;
    EXEC sp_executesql @SQL;
    PRINT 'Old constraint removed: ' + @ConstraintName;
END
ELSE
BEGIN
    PRINT 'No old constraint found (may have been removed already)';
END

PRINT '';

-- Add the new constraint with capitalized values
PRINT 'Step 3: Adding new status constraint...';

-- Check if a constraint with the new values already exists
IF NOT EXISTS (
    SELECT * FROM sys.check_constraints
    WHERE parent_object_id = OBJECT_ID('events')
      AND definition LIKE '%Planned%'
)
BEGIN
    ALTER TABLE events
    ADD CONSTRAINT CK_events_status 
    CHECK (status IN ('Planned', 'Confirmed', 'Cancelled', 'Completed'));
    
    PRINT 'New constraint added successfully!';
END
ELSE
BEGIN
    PRINT 'New constraint already exists (skipping)';
END

PRINT '';

-- Update the default constraint for status
PRINT 'Step 4: Updating default status value...';

DECLARE @DefaultConstraintName NVARCHAR(200);
SELECT @DefaultConstraintName = name
FROM sys.default_constraints
WHERE parent_object_id = OBJECT_ID('events')
  AND parent_column_id = (SELECT column_id FROM sys.columns WHERE object_id = OBJECT_ID('events') AND name = 'status');

IF @DefaultConstraintName IS NOT NULL
BEGIN
    DECLARE @DropDefaultSQL NVARCHAR(500) = 'ALTER TABLE events DROP CONSTRAINT ' + @DefaultConstraintName;
    EXEC sp_executesql @DropDefaultSQL;
    PRINT 'Old default constraint removed: ' + @DefaultConstraintName;
END

ALTER TABLE events
ADD CONSTRAINT DF_events_status DEFAULT 'Planned' FOR status;

PRINT 'New default constraint added!';
PRINT '';

-- Display summary
PRINT '==============================================';
PRINT 'Migration completed successfully!';
PRINT '==============================================';
PRINT '';
PRINT 'Summary of changes:';
PRINT '  - Updated status values: scheduled → Planned';
PRINT '  - Updated status values: cancelled → Cancelled';
PRINT '  - Updated status values: completed → Completed';
PRINT '  - Updated status values: postponed → Cancelled';
PRINT '  - Added constraint: status IN (''Planned'', ''Confirmed'', ''Cancelled'', ''Completed'')';
PRINT '  - Set default status: ''Planned''';
PRINT '';
PRINT 'Valid status values are now:';
PRINT '  - Planned (default for new events)';
PRINT '  - Confirmed (for events <24hrs away)';
PRINT '  - Cancelled (for cancelled events)';
PRINT '  - Completed (for past events)';
