IF COL_LENGTH('dbo.teams', 'spond_group_id') IS NULL
  ALTER TABLE dbo.teams ADD spond_group_id nvarchar(100) NULL;
IF COL_LENGTH('dbo.teams', 'spond_parent_group_id') IS NULL
  ALTER TABLE dbo.teams ADD spond_parent_group_id nvarchar(100) NULL;
IF COL_LENGTH('dbo.teams', 'spond_mapping_reviewed_by') IS NULL
  ALTER TABLE dbo.teams ADD spond_mapping_reviewed_by nvarchar(255) NULL;
IF COL_LENGTH('dbo.teams', 'spond_mapping_reviewed_at') IS NULL
  ALTER TABLE dbo.teams ADD spond_mapping_reviewed_at datetime2 NULL;
IF COL_LENGTH('dbo.events', 'spond_id') IS NULL
  ALTER TABLE dbo.events ADD spond_id nvarchar(100) NULL;

IF OBJECT_ID('dbo.spond_review_quotas', 'U') IS NULL
  CREATE TABLE dbo.spond_review_quotas (
    action varchar(16) NOT NULL,
    subject_id int NOT NULL,
    consumed int NOT NULL,
    resets_at datetime2 NOT NULL,
    CONSTRAINT PK_spond_review_quotas PRIMARY KEY (action, subject_id),
    CONSTRAINT CK_spond_review_quota_action CHECK (action IN ('discovery', 'review')),
    CONSTRAINT CK_spond_review_quota_subject CHECK (subject_id >= 0),
    CONSTRAINT CK_spond_review_quota_consumed CHECK (consumed > 0)
  );
