-- Combined migration script to update all tables
-- Run this script against your database to add all new fields
-- This script is safe to run multiple times (idempotent)

PRINT 'Starting database migrations...';

-- ======================================
-- TEAMS TABLE MIGRATION
-- ======================================
PRINT 'Migrating teams table...';

IF NOT EXISTS (SELECT * FROM sys.columns WHERE object_id = OBJECT_ID('teams') AND name = 'head_coach_first_name')
BEGIN
    ALTER TABLE teams ADD head_coach_first_name NVARCHAR(255);
    PRINT '  Added head_coach_first_name';
END
ELSE
BEGIN
    PRINT '  head_coach_first_name already exists';
END

IF NOT EXISTS (SELECT * FROM sys.columns WHERE object_id = OBJECT_ID('teams') AND name = 'head_coach_last_name')
BEGIN
    ALTER TABLE teams ADD head_coach_last_name NVARCHAR(255);
    PRINT '  Added head_coach_last_name';
END
ELSE
BEGIN
    PRINT '  head_coach_last_name already exists';
END

IF NOT EXISTS (SELECT * FROM sys.columns WHERE object_id = OBJECT_ID('teams') AND name = 'head_coach_email')
BEGIN
    ALTER TABLE teams ADD head_coach_email NVARCHAR(255);
    PRINT '  Added head_coach_email';
END
ELSE
BEGIN
    PRINT '  head_coach_email already exists';
END

IF NOT EXISTS (SELECT * FROM sys.columns WHERE object_id = OBJECT_ID('teams') AND name = 'head_coach_phone')
BEGIN
    ALTER TABLE teams ADD head_coach_phone NVARCHAR(50);
    PRINT '  Added head_coach_phone';
END
ELSE
BEGIN
    PRINT '  head_coach_phone already exists';
END

IF NOT EXISTS (SELECT * FROM sys.columns WHERE object_id = OBJECT_ID('teams') AND name = 'team_manager_first_name')
BEGIN
    ALTER TABLE teams ADD team_manager_first_name NVARCHAR(255);
    PRINT '  Added team_manager_first_name';
END
ELSE
BEGIN
    PRINT '  team_manager_first_name already exists';
END

IF NOT EXISTS (SELECT * FROM sys.columns WHERE object_id = OBJECT_ID('teams') AND name = 'team_manager_last_name')
BEGIN
    ALTER TABLE teams ADD team_manager_last_name NVARCHAR(255);
    PRINT '  Added team_manager_last_name';
END
ELSE
BEGIN
    PRINT '  team_manager_last_name already exists';
END

IF NOT EXISTS (SELECT * FROM sys.columns WHERE object_id = OBJECT_ID('teams') AND name = 'team_manager_email')
BEGIN
    ALTER TABLE teams ADD team_manager_email NVARCHAR(255);
    PRINT '  Added team_manager_email';
END
ELSE
BEGIN
    PRINT '  team_manager_email already exists';
END

IF NOT EXISTS (SELECT * FROM sys.columns WHERE object_id = OBJECT_ID('teams') AND name = 'team_manager_phone')
BEGIN
    ALTER TABLE teams ADD team_manager_phone NVARCHAR(50);
    PRINT '  Added team_manager_phone';
END
ELSE
BEGIN
    PRINT '  team_manager_phone already exists';
END

PRINT 'Teams table migration completed!';

-- ======================================
-- SITES TABLE MIGRATION
-- ======================================
PRINT 'Migrating sites table...';

IF NOT EXISTS (SELECT * FROM sys.columns WHERE object_id = OBJECT_ID('sites') AND name = 'city')
BEGIN
    ALTER TABLE sites ADD city NVARCHAR(255);
    PRINT '  Added city';
END
ELSE
BEGIN
    PRINT '  city already exists';
END

IF NOT EXISTS (SELECT * FROM sys.columns WHERE object_id = OBJECT_ID('sites') AND name = 'zip_code')
BEGIN
    ALTER TABLE sites ADD zip_code NVARCHAR(20);
    PRINT '  Added zip_code';
END
ELSE
BEGIN
    PRINT '  zip_code already exists';
END

IF NOT EXISTS (SELECT * FROM sys.columns WHERE object_id = OBJECT_ID('sites') AND name = 'latitude')
BEGIN
    ALTER TABLE sites ADD latitude FLOAT;
    PRINT '  Added latitude';
END
ELSE
BEGIN
    PRINT '  latitude already exists';
END

IF NOT EXISTS (SELECT * FROM sys.columns WHERE object_id = OBJECT_ID('sites') AND name = 'longitude')
BEGIN
    ALTER TABLE sites ADD longitude FLOAT;
    PRINT '  Added longitude';
END
ELSE
BEGIN
    PRINT '  longitude already exists';
END

IF NOT EXISTS (SELECT * FROM sys.columns WHERE object_id = OBJECT_ID('sites') AND name = 'contact_first_name')
BEGIN
    ALTER TABLE sites ADD contact_first_name NVARCHAR(255);
    PRINT '  Added contact_first_name';
END
ELSE
BEGIN
    PRINT '  contact_first_name already exists';
END

IF NOT EXISTS (SELECT * FROM sys.columns WHERE object_id = OBJECT_ID('sites') AND name = 'contact_last_name')
BEGIN
    ALTER TABLE sites ADD contact_last_name NVARCHAR(255);
    PRINT '  Added contact_last_name';
END
ELSE
BEGIN
    PRINT '  contact_last_name already exists';
END

IF NOT EXISTS (SELECT * FROM sys.columns WHERE object_id = OBJECT_ID('sites') AND name = 'contact_phone')
BEGIN
    ALTER TABLE sites ADD contact_phone NVARCHAR(50);
    PRINT '  Added contact_phone';
END
ELSE
BEGIN
    PRINT '  contact_phone already exists';
END

IF NOT EXISTS (SELECT * FROM sys.columns WHERE object_id = OBJECT_ID('sites') AND name = 'contact_email')
BEGIN
    ALTER TABLE sites ADD contact_email NVARCHAR(255);
    PRINT '  Added contact_email';
END
ELSE
BEGIN
    PRINT '  contact_email already exists';
END

IF NOT EXISTS (SELECT * FROM sys.columns WHERE object_id = OBJECT_ID('sites') AND name = 'is_sports_facility')
BEGIN
    ALTER TABLE sites ADD is_sports_facility BIT DEFAULT 1;
    PRINT '  Added is_sports_facility';
END
ELSE
BEGIN
    PRINT '  is_sports_facility already exists';
END

IF NOT EXISTS (SELECT * FROM sys.columns WHERE object_id = OBJECT_ID('sites') AND name = 'active')
BEGIN
    ALTER TABLE sites ADD active BIT DEFAULT 1;
    PRINT '  Added active';
END
ELSE
BEGIN
    PRINT '  active already exists';
END

-- Update existing records to have default values for sites
UPDATE sites SET city = '' WHERE city IS NULL;
UPDATE sites SET zip_code = '' WHERE zip_code IS NULL;
UPDATE sites SET latitude = 0 WHERE latitude IS NULL;
UPDATE sites SET longitude = 0 WHERE longitude IS NULL;
UPDATE sites SET contact_first_name = '' WHERE contact_first_name IS NULL;
UPDATE sites SET contact_last_name = '' WHERE contact_last_name IS NULL;
UPDATE sites SET contact_phone = '' WHERE contact_phone IS NULL;
UPDATE sites SET contact_email = '' WHERE contact_email IS NULL;
UPDATE sites SET is_sports_facility = 1 WHERE is_sports_facility IS NULL;
UPDATE sites SET active = 1 WHERE active IS NULL;

PRINT 'Sites table migration completed!';

-- ======================================
-- FIELDS TABLE MIGRATION
-- ======================================
PRINT 'Migrating fields table...';

IF NOT EXISTS (SELECT * FROM sys.columns WHERE object_id = OBJECT_ID('fields') AND name = 'has_lights')
BEGIN
    ALTER TABLE fields ADD has_lights BIT DEFAULT 0;
    PRINT '  Added has_lights';
END
ELSE
BEGIN
    PRINT '  has_lights already exists';
END

IF NOT EXISTS (SELECT * FROM sys.columns WHERE object_id = OBJECT_ID('fields') AND name = 'capacity')
BEGIN
    ALTER TABLE fields ADD capacity INT;
    PRINT '  Added capacity';
END
ELSE
BEGIN
    PRINT '  capacity already exists';
END

IF NOT EXISTS (SELECT * FROM sys.columns WHERE object_id = OBJECT_ID('fields') AND name = 'active')
BEGIN
    ALTER TABLE fields ADD active BIT DEFAULT 1;
    PRINT '  Added active';
END
ELSE
BEGIN
    PRINT '  active already exists';
END

-- Update existing records to have default values for fields
UPDATE fields SET has_lights = 0 WHERE has_lights IS NULL;
UPDATE fields SET active = 1 WHERE active IS NULL;

PRINT 'Fields table migration completed!';

PRINT '';
PRINT '==============================================';
PRINT 'All database migrations completed successfully!';
PRINT '==============================================';
