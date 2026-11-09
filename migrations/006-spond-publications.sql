CREATE TABLE dbo.spond_publications (
  event_id int NOT NULL PRIMARY KEY,
  publication_id uniqueidentifier NOT NULL UNIQUE,
  group_id char(32) NOT NULL,
  parent_group_id char(32) NULL,
  source_hash char(64) NOT NULL,
  approved_by int NOT NULL,
  state varchar(16) NOT NULL CHECK (state IN ('reserved', 'published', 'uncertain')),
  provider_id char(32) NULL,
  created_at datetime2 NOT NULL DEFAULT SYSUTCDATETIME(),
  updated_at datetime2 NOT NULL DEFAULT SYSUTCDATETIME(),
  CHECK ((state = 'published' AND provider_id IS NOT NULL) OR state <> 'published')
);
