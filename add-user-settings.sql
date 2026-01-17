-- Migration: Add user_settings table for persistent user preferences
-- This stores settings like share notifications preference per user

-- Create user_settings table if it doesn't exist
IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = 'user_settings')
BEGIN
    CREATE TABLE user_settings (
        id INT PRIMARY KEY IDENTITY(1,1),
        user_id INT NOT NULL,
        setting_key NVARCHAR(100) NOT NULL,
        setting_value NVARCHAR(MAX),
        created_at DATETIME DEFAULT GETDATE(),
        updated_at DATETIME DEFAULT GETDATE(),
        CONSTRAINT FK_user_settings_users FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
        CONSTRAINT UQ_user_settings_user_key UNIQUE (user_id, setting_key)
    );
    
    CREATE INDEX idx_user_settings_user_id ON user_settings(user_id);
    CREATE INDEX idx_user_settings_key ON user_settings(setting_key);
    
    PRINT 'Created user_settings table';
END
ELSE
BEGIN
    PRINT 'user_settings table already exists';
END
GO

-- Create spond_config table if it doesn't exist (for Spond integration)
IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = 'spond_config')
BEGIN
    CREATE TABLE spond_config (
        id INT PRIMARY KEY IDENTITY(1,1),
        username NVARCHAR(255) NOT NULL,
        password NVARCHAR(255) NOT NULL,
        auto_sync BIT DEFAULT 0,
        sync_interval_minutes INT DEFAULT 60,
        is_active BIT DEFAULT 1,
        last_sync DATETIME,
        created_at DATETIME DEFAULT GETDATE(),
        updated_at DATETIME DEFAULT GETDATE()
    );
    
    PRINT 'Created spond_config table';
END
ELSE
BEGIN
    PRINT 'spond_config table already exists';
END
GO
