-- Fix existing team linked to Spond subgroup
-- Run this AFTER running migrate-spond-parent-group-id.sql
--
-- Your team is linked to subgroup: 41B5BD87392941BEB6C940CB0BA15217
-- The parent group ID is: A6C03B65982444C18328024047630CB9
-- Correct Spond URL format: https://spond.com/client/groups/A6C03B65982444C18328024047630CB9-S-41B5BD87392941BEB6C940CB0BA15217

-- Update the sync settings for teams linked to this subgroup
UPDATE spond_sync_settings 
SET spond_parent_group_id = 'A6C03B65982444C18328024047630CB9',
    is_subgroup = 1,
    updated_at = GETDATE()
WHERE spond_group_id = '41B5BD87392941BEB6C940CB0BA15217';

-- Also update if stored in uppercase (Spond IDs can come in different formats)
UPDATE spond_sync_settings 
SET spond_parent_group_id = 'A6C03B65982444C18328024047630CB9',
    is_subgroup = 1,
    updated_at = GETDATE()
WHERE LOWER(spond_group_id) = LOWER('41B5BD87392941BEB6C940CB0BA15217');

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

PRINT 'Parent group ID set for team(s) linked to subgroup 41B5BD87392941BEB6C940CB0BA15217';
