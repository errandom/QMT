-- Add field_ids column to events table
-- This allows events to be associated with multiple fields/meeting rooms

IF NOT EXISTS (SELECT * FROM sys.columns WHERE object_id = OBJECT_ID(N'events') AND name = 'field_ids')
BEGIN
    ALTER TABLE events ADD field_ids NVARCHAR(255) NULL;
    PRINT 'Added field_ids column to events table';
    
    -- Migrate existing field_id values to field_ids (using dynamic SQL to avoid parse error)
    EXEC('UPDATE events SET field_ids = CAST(field_id AS NVARCHAR(255)) WHERE field_id IS NOT NULL');
    PRINT 'Migrated existing field_id values to field_ids';
END
ELSE
BEGIN
    PRINT 'field_ids column already exists (skipping)';
END
GO
