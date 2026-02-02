-- Add spond_parent_group_id column for subgroup event creation
-- When a team is linked to a subgroup, we need the parent group ID 
-- to correctly create events in Spond API

IF NOT EXISTS (SELECT * FROM sys.columns WHERE object_id = OBJECT_ID('spond_sync_settings') AND name = 'spond_parent_group_id')
BEGIN
    ALTER TABLE spond_sync_settings ADD spond_parent_group_id NVARCHAR(100) NULL;
    PRINT 'Added spond_parent_group_id column to spond_sync_settings table';
END
GO
