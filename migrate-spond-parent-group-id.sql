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

-- =====================================================
-- 3. Update existing teams that are linked to Spond subgroups
-- =====================================================
-- If you have teams linked to Spond subgroups, you need to set their parent_group_id
-- 
-- Example: If your team is linked to subgroup 41B5BD87392941BEB6C940CB0BA15217
-- and the parent group is A6C03B65982444C18328024047630CB9, run:
--
-- UPDATE spond_sync_settings 
-- SET spond_parent_group_id = 'A6C03B65982444C18328024047630CB9',
--     is_subgroup = 1
-- WHERE spond_group_id = '41B5BD87392941BEB6C940CB0BA15217';
--
-- Or update all sync settings for a specific team by team name:
--
-- UPDATE ss
-- SET ss.spond_parent_group_id = 'YOUR_PARENT_GROUP_ID',
--     ss.is_subgroup = 1
-- FROM spond_sync_settings ss
-- INNER JOIN teams t ON ss.team_id = t.id
-- WHERE t.name = 'YOUR_TEAM_NAME';

PRINT 'Migration complete: spond_parent_group_id column added to spond_sync_settings';
PRINT 'NOTE: Run the UPDATE statements above for existing teams linked to Spond subgroups';
