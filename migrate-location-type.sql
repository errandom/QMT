-- Add location_type column to fields table
-- This allows distinguishing between fields (for sports facilities) and meeting rooms (for other sites)

IF NOT EXISTS (SELECT * FROM sys.columns WHERE object_id = OBJECT_ID(N'fields') AND name = 'location_type')
BEGIN
    ALTER TABLE fields ADD location_type NVARCHAR(50) DEFAULT 'field';
    PRINT 'Added location_type column to fields table';
    
    -- Update existing records to have 'field' as the default
    UPDATE fields SET location_type = 'field' WHERE location_type IS NULL;
    PRINT 'Set default location_type for existing fields';
END
ELSE
BEGIN
    PRINT 'location_type column already exists (skipping)';
END
GO
