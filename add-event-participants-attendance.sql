-- Add other_participants and estimated_attendance columns to events table
-- other_participants: stores names of participants not in teams (e.g., guest teams, officials)
-- estimated_attendance: stores expected number of attendees for the event

-- Add other_participants column
IF NOT EXISTS (SELECT * FROM sys.columns WHERE object_id = OBJECT_ID(N'events') AND name = 'other_participants')
BEGIN
    ALTER TABLE events ADD other_participants NVARCHAR(500) NULL;
    PRINT 'Added other_participants column to events table';
END

-- Add estimated_attendance column
IF NOT EXISTS (SELECT * FROM sys.columns WHERE object_id = OBJECT_ID(N'events') AND name = 'estimated_attendance')
BEGIN
    ALTER TABLE events ADD estimated_attendance INT NULL;
    PRINT 'Added estimated_attendance column to events table';
END

GO
