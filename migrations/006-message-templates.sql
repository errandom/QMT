CREATE TABLE dbo.message_templates (
  template_key nvarchar(80) NOT NULL,
  language nvarchar(2) NOT NULL CHECK (language IN ('en', 'de')),
  subject nvarchar(220) NULL,
  message nvarchar(max) NULL,
  recipient nvarchar(5200) NULL,
  revision int NOT NULL CHECK (revision > 0),
  customized bit NOT NULL,
  updated_by nvarchar(255) NOT NULL,
  updated_at datetime2 NOT NULL DEFAULT SYSUTCDATETIME(),
  CONSTRAINT PK_message_templates PRIMARY KEY (template_key, language),
  CHECK ((customized = 1 AND subject IS NOT NULL AND message IS NOT NULL)
    OR (customized = 0 AND subject IS NULL AND message IS NULL))
);
