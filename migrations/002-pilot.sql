IF COL_LENGTH('dbo.events', 'team_ids') IS NULL ALTER TABLE dbo.events ADD team_ids nvarchar(255);
IF COL_LENGTH('dbo.events', 'field_ids') IS NULL ALTER TABLE dbo.events ADD field_ids nvarchar(255);
IF COL_LENGTH('dbo.events', 'notes') IS NULL ALTER TABLE dbo.events ADD notes nvarchar(2000);
IF COL_LENGTH('dbo.events', 'recurring_days') IS NULL ALTER TABLE dbo.events ADD recurring_days nvarchar(50);
IF COL_LENGTH('dbo.events', 'recurring_end_date') IS NULL ALTER TABLE dbo.events ADD recurring_end_date date;
IF COL_LENGTH('dbo.events', 'other_participants') IS NULL ALTER TABLE dbo.events ADD other_participants nvarchar(500);
IF COL_LENGTH('dbo.events', 'estimated_attendance') IS NULL ALTER TABLE dbo.events ADD estimated_attendance int;
IF COL_LENGTH('dbo.events', 'game_location') IS NULL ALTER TABLE dbo.events ADD game_location nvarchar(10);
IF COL_LENGTH('dbo.events', 'away_street') IS NULL ALTER TABLE dbo.events ADD away_street nvarchar(255);
IF COL_LENGTH('dbo.events', 'away_zip') IS NULL ALTER TABLE dbo.events ADD away_zip nvarchar(20);
IF COL_LENGTH('dbo.events', 'away_city') IS NULL ALTER TABLE dbo.events ADD away_city nvarchar(255);
IF COL_LENGTH('dbo.events', 'transport_requested') IS NULL ALTER TABLE dbo.events ADD transport_requested bit NOT NULL DEFAULT 0;
IF COL_LENGTH('dbo.events', 'transport_request_sent_at') IS NULL ALTER TABLE dbo.events ADD transport_request_sent_at datetime2;
IF COL_LENGTH('dbo.fields', 'location_type') IS NULL ALTER TABLE dbo.fields ADD location_type nvarchar(50) NOT NULL DEFAULT 'field';
IF COL_LENGTH('dbo.requests', 'payload') IS NULL ALTER TABLE dbo.requests ADD payload nvarchar(max);
IF COL_LENGTH('dbo.requests', 'client_key') IS NULL ALTER TABLE dbo.requests ADD client_key uniqueidentifier;
IF COL_LENGTH('dbo.requests', 'reviewed_at') IS NULL ALTER TABLE dbo.requests ADD reviewed_at datetime2;
IF COL_LENGTH('dbo.requests', 'reviewed_by') IS NULL ALTER TABLE dbo.requests ADD reviewed_by nvarchar(255);
GO
UPDATE dbo.events SET field_ids = CONVERT(nvarchar(20), field_id) WHERE field_ids IS NULL AND field_id IS NOT NULL;
UPDATE dbo.events SET team_ids = CONVERT(nvarchar(20), team_id) WHERE team_ids IS NULL AND team_id IS NOT NULL;
GO
IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE object_id = OBJECT_ID('dbo.requests') AND name = 'UX_qmt_requests_client_key')
CREATE UNIQUE INDEX UX_qmt_requests_client_key ON dbo.requests(client_key) WHERE client_key IS NOT NULL;
IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE object_id = OBJECT_ID('dbo.events') AND name = 'IX_qmt_events_range')
CREATE INDEX IX_qmt_events_range ON dbo.events(start_time, end_time) INCLUDE (id, field_id, status);
