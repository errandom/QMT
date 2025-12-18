-- Migration script to add missing columns to fields table
-- Run this script against your database to add the new fields

-- Check if columns exist before adding them to avoid errors
IF NOT EXISTS (SELECT * FROM sys.columns WHERE object_id = OBJECT_ID('fields') AND name = 'has_lights')
BEGIN
    ALTER TABLE fields ADD has_lights BIT DEFAULT 0;
END

IF NOT EXISTS (SELECT * FROM sys.columns WHERE object_id = OBJECT_ID('fields') AND name = 'capacity')
BEGIN
    ALTER TABLE fields ADD capacity INT;
END

IF NOT EXISTS (SELECT * FROM sys.columns WHERE object_id = OBJECT_ID('fields') AND name = 'active')
BEGIN
    ALTER TABLE fields ADD active BIT DEFAULT 1;
END

-- Update existing records to have default values
UPDATE fields SET has_lights = 0 WHERE has_lights IS NULL;
UPDATE fields SET active = 1 WHERE active IS NULL;

PRINT 'Fields table migration completed successfully!';
