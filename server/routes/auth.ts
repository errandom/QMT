import { Router, Request, Response } from 'express';
import { getPool } from '../db.js';
import sql from 'mssql';
import bcrypt from 'bcryptjs';
import { generateToken, authenticateToken, AuthRequest } from '../middleware/auth.js';

const router = Router();

// POST /api/auth/login - Login endpoint
router.post('/login', async (req: Request, res: Response) => {
  try {
    const { username, password } = req.body;

    if (!username || !password) {
      return res.status(400).json({ error: 'Username and password required' });
    }

    const pool = await getPool();
    const result = await pool.request()
      .input('username', sql.NVarChar, username)
      .query(`
        SELECT id, username, password_hash, role, is_active, email, full_name
        FROM users
        WHERE username = @username
      `);

    if (result.recordset.length === 0) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    const user = result.recordset[0];

    if (!user.is_active) {
      return res.status(403).json({ error: 'Account is inactive' });
    }

    // Verify password
    const isValidPassword = await bcrypt.compare(password, user.password_hash);
    if (!isValidPassword) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    // Generate token
    const token = generateToken({
      id: user.id,
      username: user.username,
      role: user.role,
    });

    res.json({
      token,
      user: {
        id: user.id,
        username: user.username,
        role: user.role,
        email: user.email,
        fullName: user.full_name,
      },
    });
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ error: 'Login failed' });
  }
});

// GET /api/auth/users - Get all users (admin only)
router.get('/users', authenticateToken, async (req: AuthRequest, res: Response) => {
  try {
    // Only admins can view users
    if (req.user?.role !== 'admin') {
      return res.status(403).json({ error: 'Admin privileges required' });
    }

    const pool = await getPool();
    const result = await pool.request()
      .query(`
        SELECT id, username, role, email, full_name, is_active, created_at, updated_at
        FROM users
        ORDER BY created_at DESC
      `);

    res.json(result.recordset);
  } catch (error) {
    console.error('Error fetching users:', error);
    res.status(500).json({ error: 'Failed to fetch users' });
  }
});

// POST /api/auth/register - Register new user (admin only)
router.post('/register', authenticateToken, async (req: AuthRequest, res: Response) => {
  try {
    // Only admins can create new users
    if (req.user?.role !== 'admin') {
      return res.status(403).json({ error: 'Admin privileges required' });
    }

    const { username, password, role, email, fullName } = req.body;

    if (!username || !password || !role) {
      return res.status(400).json({ error: 'Username, password, and role required' });
    }

    // Validate role
    if (!['admin', 'mgmt', 'user'].includes(role)) {
      return res.status(400).json({ error: 'Invalid role' });
    }

    // Hash password
    const passwordHash = await bcrypt.hash(password, 10);

    const pool = await getPool();
    const result = await pool.request()
      .input('username', sql.NVarChar, username)
      .input('password_hash', sql.NVarChar, passwordHash)
      .input('role', sql.NVarChar, role)
      .input('email', sql.NVarChar, email || null)
      .input('full_name', sql.NVarChar, fullName || null)
      .query(`
        INSERT INTO users (username, password_hash, role, email, full_name, is_active)
        OUTPUT INSERTED.id, INSERTED.username, INSERTED.role, INSERTED.email, INSERTED.full_name
        VALUES (@username, @password_hash, @role, @email, @full_name, 1)
      `);

    res.status(201).json(result.recordset[0]);
  } catch (error: any) {
    console.error('Registration error:', error);
    if (error.number === 2627) { // Unique constraint violation
      return res.status(409).json({ error: 'Username already exists' });
    }
    res.status(500).json({ error: 'Registration failed' });
  }
});

// GET /api/auth/me - Get current user info
router.get('/me', authenticateToken, async (req: AuthRequest, res: Response) => {
  try {
    const pool = await getPool();
    const result = await pool.request()
      .input('id', sql.Int, req.user!.id)
      .query(`
        SELECT id, username, role, email, full_name, is_active, created_at
        FROM users
        WHERE id = @id
      `);

    if (result.recordset.length === 0) {
      return res.status(404).json({ error: 'User not found' });
    }

    res.json(result.recordset[0]);
  } catch (error) {
    console.error('Error fetching user:', error);
    res.status(500).json({ error: 'Failed to fetch user' });
  }
});

// POST /api/auth/change-password - Change password
router.post('/change-password', authenticateToken, async (req: AuthRequest, res: Response) => {
  try {
    const { currentPassword, newPassword } = req.body;

    if (!currentPassword || !newPassword) {
      return res.status(400).json({ error: 'Current and new password required' });
    }

    const pool = await getPool();
    
    // Get current password hash
    const userResult = await pool.request()
      .input('id', sql.Int, req.user!.id)
      .query('SELECT password_hash FROM users WHERE id = @id');

    if (userResult.recordset.length === 0) {
      return res.status(404).json({ error: 'User not found' });
    }

    // Verify current password
    const isValid = await bcrypt.compare(currentPassword, userResult.recordset[0].password_hash);
    if (!isValid) {
      return res.status(401).json({ error: 'Current password is incorrect' });
    }

    // Hash new password
    const newPasswordHash = await bcrypt.hash(newPassword, 10);

    // Update password
    await pool.request()
      .input('id', sql.Int, req.user!.id)
      .input('password_hash', sql.NVarChar, newPasswordHash)
      .query('UPDATE users SET password_hash = @password_hash, updated_at = GETDATE() WHERE id = @id');

    res.json({ message: 'Password updated successfully' });
  } catch (error) {
    console.error('Error changing password:', error);
    res.status(500).json({ error: 'Failed to change password' });
  }
});

// PUT /api/auth/users/:id - Update user (admin or self)
router.put('/users/:id', authenticateToken, async (req: AuthRequest, res: Response) => {
  try {
    const userId = parseInt(req.params.id);
    const { username, role, email, fullName, isActive } = req.body;

    // Users can update their own email/fullName, admins can update anyone's everything
    const isOwnProfile = req.user!.id === userId;
    const isAdmin = req.user!.role === 'admin';

    if (!isOwnProfile && !isAdmin) {
      return res.status(403).json({ error: 'Permission denied' });
    }

    // Only admins can change roles and active status
    if (!isAdmin && (role || isActive !== undefined)) {
      return res.status(403).json({ error: 'Admin privileges required to change role or active status' });
    }

    const pool = await getPool();

    // Build update query dynamically based on permissions
    let updateFields = [];
    let request = pool.request().input('id', sql.Int, userId);

    if (username && isAdmin) {
      updateFields.push('username = @username');
      request.input('username', sql.NVarChar, username);
    }

    if (role && isAdmin) {
      if (!['admin', 'mgmt', 'user'].includes(role)) {
        return res.status(400).json({ error: 'Invalid role' });
      }
      updateFields.push('role = @role');
      request.input('role', sql.NVarChar, role);
    }

    if (email !== undefined) {
      updateFields.push('email = @email');
      request.input('email', sql.NVarChar, email || null);
    }

    if (fullName !== undefined) {
      updateFields.push('full_name = @full_name');
      request.input('full_name', sql.NVarChar, fullName || null);
    }

    if (isActive !== undefined && isAdmin) {
      updateFields.push('is_active = @is_active');
      request.input('is_active', sql.Bit, isActive);
    }

    if (updateFields.length === 0) {
      return res.status(400).json({ error: 'No fields to update' });
    }

    updateFields.push('updated_at = GETDATE()');

    const result = await request.query(`
      UPDATE users 
      SET ${updateFields.join(', ')}
      OUTPUT INSERTED.id, INSERTED.username, INSERTED.role, INSERTED.email, INSERTED.full_name, INSERTED.is_active
      WHERE id = @id
    `);

    if (result.recordset.length === 0) {
      return res.status(404).json({ error: 'User not found' });
    }

    res.json(result.recordset[0]);
  } catch (error: any) {
    console.error('Error updating user:', error);
    if (error.number === 2627) { // Unique constraint violation
      return res.status(409).json({ error: 'Username already exists' });
    }
    res.status(500).json({ error: 'Failed to update user' });
  }
});

// DELETE /api/auth/users/:id - Delete user (admin only)
router.delete('/users/:id', authenticateToken, async (req: AuthRequest, res: Response) => {
  try {
    if (req.user!.role !== 'admin') {
      return res.status(403).json({ error: 'Admin privileges required' });
    }

    const userId = parseInt(req.params.id);

    // Prevent self-deletion
    if (req.user!.id === userId) {
      return res.status(400).json({ error: 'Cannot delete your own account' });
    }

    const pool = await getPool();
    const result = await pool.request()
      .input('id', sql.Int, userId)
      .query('DELETE FROM users WHERE id = @id');

    if (result.rowsAffected[0] === 0) {
      return res.status(404).json({ error: 'User not found' });
    }

    res.json({ message: 'User deleted successfully' });
  } catch (error) {
    console.error('Error deleting user:', error);
    res.status(500).json({ error: 'Failed to delete user' });
  }
});

export default router;
