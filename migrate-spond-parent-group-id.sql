-- Add spond_parent_group_id column to spond_sync_settings
-- This column stores the parent Spond group ID for teams that are subgroups
-- Required for proper event export to Spond when using subgroups

-- =====================================================
-- 1. Add spond_parent_group_id column
-- =====================================================
IF NOT EXISTS (SELECT * FROM sys.columns WHERE object_id = OBJECT_ID('spond_sync_settings') AND name = 'spond_parent_group_id')
BEGIN
    ALTER TABLE spond_sync_settings ADD spond_parent_group_id NVARCHAR(100) NULL;
    PRINT 'Added spond_parent_group_id column to spond_sync_settings table';
END
GO

-- =====================================================
-- 2. Create index for faster lookups
-- =====================================================
IF NOT EXISTS (SELECT * FROM sys.indexes WHERE name = 'IX_spond_sync_parent_group_id' AND object_id = OBJECT_ID('spond_sync_settings'))
BEGIN
    CREATE INDEX IX_spond_sync_parent_group_id ON spond_sync_settings(spond_parent_group_id);
    PRINT 'Created index on spond_parent_group_id';
END
GO

PRINT 'Migration complete: spond_parent_group_id column added to spond_sync_settings';
