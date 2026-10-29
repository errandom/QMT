IF COL_LENGTH('dbo.sites', 'published_schedule_url') IS NULL
ALTER TABLE dbo.sites ADD published_schedule_url nvarchar(2048) NULL;
IF COL_LENGTH('dbo.sites', 'published_booking_name') IS NULL
ALTER TABLE dbo.sites ADD published_booking_name nvarchar(200) NULL;
