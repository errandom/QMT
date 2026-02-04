-- User Login History Table
-- This table captures all successful login attempts with IP address and timestamp

-- Create user_logins table if it doesn't exist
IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = 'user_logins')
BEGIN
  CREATE TABLE user_logins (
    id INT PRIMARY KEY IDENTITY(1,1),
    user_id INT NOT NULL,
    username NVARCHAR(255) NOT NULL,
    ip_address NVARCHAR(45),  -- Supports both IPv4 and IPv6
    user_agent NVARCHAR(500),
    login_time DATETIME DEFAULT GETDATE(),
    CONSTRAINT FK_user_logins_users FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
  );

  -- Create index for faster lookups by user
  CREATE INDEX IX_user_logins_user_id ON user_logins(user_id);
  
  -- Create index for faster lookups by login time
  CREATE INDEX IX_user_logins_login_time ON user_logins(login_time);
  
  PRINT 'Created user_logins table with indexes';
END
ELSE
BEGIN
  PRINT 'user_logins table already exists';
END
