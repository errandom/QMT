ALTER TABLE events ADD series_id uniqueidentifier NULL;
ALTER TABLE events ADD allocation_json nvarchar(max) NULL;
CREATE INDEX IX_events_series ON events(series_id, start_time);

CREATE TABLE event_operations (
  event_id int NOT NULL PRIMARY KEY REFERENCES events(id) ON DELETE CASCADE,
  revision int NOT NULL,
  payload nvarchar(max) NOT NULL CHECK (ISJSON(payload) = 1),
  updated_at datetime2 NOT NULL DEFAULT SYSUTCDATETIME()
);

CREATE TABLE external_allocations (
  id uniqueidentifier NOT NULL PRIMARY KEY,
  field_id int NOT NULL REFERENCES fields(id),
  participant nvarchar(255) NOT NULL,
  start_time datetime2 NOT NULL,
  end_time datetime2 NOT NULL,
  zones nvarchar(100) NOT NULL,
  active bit NOT NULL DEFAULT 1,
  revision int NOT NULL DEFAULT 1,
  updated_at datetime2 NOT NULL DEFAULT SYSUTCDATETIME(),
  CHECK (end_time > start_time)
);
CREATE INDEX IX_external_allocations_window ON external_allocations(field_id, start_time, end_time);

CREATE TABLE request_communications (
  id uniqueidentifier NOT NULL PRIMARY KEY,
  request_id int NOT NULL REFERENCES requests(id),
  direction nvarchar(10) NOT NULL,
  status nvarchar(20) NOT NULL,
  recipient nvarchar(254) NOT NULL,
  subject nvarchar(255) NOT NULL,
  message nvarchar(max) NOT NULL,
  workflow_action nvarchar(20) NULL,
  expected_version int NULL,
  provider_id nvarchar(512) NULL,
  recorded_by nvarchar(255) NOT NULL,
  created_at datetime2 NOT NULL DEFAULT SYSUTCDATETIME()
);
CREATE UNIQUE INDEX IX_request_communications_provider ON request_communications(provider_id)
  WHERE provider_id IS NOT NULL;
