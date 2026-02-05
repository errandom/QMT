-- Fix existing team linked to Spond subgroup
-- Run this AFTER running migrate-spond-parent-group-id.sql
--
-- Your team is linked to subgroup: 41B5BD87392941BEB6C940CB0BA15217
-- The parent group ID is: A6C03B65982444C18328024047630CB9
-- Correct Spond URL format: https://spond.com/client/groups/A6C03B65982444C18328024047630CB9-S-41B5BD87392941BEB6C940CB0BA15217
--
-- NOTE: Spond IDs should be stored in uppercase WITHOUT hyphens

-- First, normalize any existing IDs that have hyphens to the proper format
-- Update teams table
UPDATE teams 
SET spond_group_id = UPPER(REPLACE(spond_group_id, '-', ''))
WHERE spond_group_id LIKE '%-%';

-- Update spond_sync_settings table
UPDATE spond_sync_settings 
SET spond_group_id = UPPER(REPLACE(spond_group_id, '-', ''))
WHERE spond_group_id LIKE '%-%';

UPDATE spond_sync_settings 
SET spond_parent_group_id = UPPER(REPLACE(spond_parent_group_id, '-', ''))
WHERE spond_parent_group_id LIKE '%-%';

-- Now set the parent group ID for teams linked to this subgroup
UPDATE spond_sync_settings 
SET spond_parent_group_id = 'A6C03B65982444C18328024047630CB9',
    is_subgroup = 1,
    updated_at = GETDATE()
WHERE UPPER(REPLACE(spond_group_id, '-', '')) = '41B5BD87392941BEB6C940CB0BA15217';

-- Verify the update
SELECT 
    t.id as team_id,
    t.name as team_name,
    t.spond_group_id as team_spond_id,
    ss.spond_group_id as sync_spond_id,
    ss.spond_parent_group_id,
    ss.is_subgroup
FROM teams t
LEFT JOIN spond_sync_settings ss ON t.id = ss.team_id
WHERE t.spond_group_id IS NOT NULL;

PRINT 'Spond IDs normalized and parent group ID set for subgroups';
