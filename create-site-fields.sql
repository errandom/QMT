-- Create placeholder fields for non-sports sites
-- This allows Meeting/Other events to reference sites through the field_id

-- For each non-sports site, create a field entry if it doesn't exist
INSERT INTO fields (site_id, name, field_type, surface_type, has_lights, capacity, active)
SELECT 
    s.id,
    s.name + ' (Site)',
    'Meeting Room',
    NULL,
    0,
    NULL,
    s.active
FROM sites s
WHERE s.is_sports_facility = 0
    AND NOT EXISTS (
        SELECT 1 FROM fields f 
        WHERE f.site_id = s.id 
        AND f.field_type = 'Meeting Room'
    );

-- Show the created fields
SELECT 
    f.id as field_id,
    f.name as field_name,
    s.name as site_name,
    s.is_sports_facility
FROM fields f
JOIN sites s ON f.site_id = s.id
WHERE f.field_type = 'Meeting Room'
ORDER BY s.name;
