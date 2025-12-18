-- Migration script to add missing columns to sites table
-- Run this script against your database to add the new fields

-- Check if columns exist before adding them to avoid errors
IF NOT EXISTS (SELECT * FROM sys.columns WHERE object_id = OBJECT_ID('sites') AND name = 'city')
BEGIN
    ALTER TABLE sites ADD city NVARCHAR(255);
END

IF NOT EXISTS (SELECT * FROM sys.columns WHERE object_id = OBJECT_ID('sites') AND name = 'zip_code')
BEGIN
    ALTER TABLE sites ADD zip_code NVARCHAR(20);
END

IF NOT EXISTS (SELECT * FROM sys.columns WHERE object_id = OBJECT_ID('sites') AND name = 'latitude')
BEGIN
    ALTER TABLE sites ADD latitude FLOAT;
END

IF NOT EXISTS (SELECT * FROM sys.columns WHERE object_id = OBJECT_ID('sites') AND name = 'longitude')
BEGIN
    ALTER TABLE sites ADD longitude FLOAT;
END

IF NOT EXISTS (SELECT * FROM sys.columns WHERE object_id = OBJECT_ID('sites') AND name = 'contact_first_name')
BEGIN
    ALTER TABLE sites ADD contact_first_name NVARCHAR(255);
END

IF NOT EXISTS (SELECT * FROM sys.columns WHERE object_id = OBJECT_ID('sites') AND name = 'contact_last_name')
BEGIN
    ALTER TABLE sites ADD contact_last_name NVARCHAR(255);
END

IF NOT EXISTS (SELECT * FROM sys.columns WHERE object_id = OBJECT_ID('sites') AND name = 'contact_phone')
BEGIN
    ALTER TABLE sites ADD contact_phone NVARCHAR(50);
END

IF NOT EXISTS (SELECT * FROM sys.columns WHERE object_id = OBJECT_ID('sites') AND name = 'contact_email')
BEGIN
    ALTER TABLE sites ADD contact_email NVARCHAR(255);
END

IF NOT EXISTS (SELECT * FROM sys.columns WHERE object_id = OBJECT_ID('sites') AND name = 'is_sports_facility')
BEGIN
    ALTER TABLE sites ADD is_sports_facility BIT DEFAULT 1;
END

IF NOT EXISTS (SELECT * FROM sys.columns WHERE object_id = OBJECT_ID('sites') AND name = 'active')
BEGIN
    ALTER TABLE sites ADD active BIT DEFAULT 1;
END

-- Update existing records to have default values
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

PRINT 'Sites table migration completed successfully!';
