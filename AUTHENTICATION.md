# 🔐 Authentication & Authorization Guide

## Overview

The application now has a complete JWT-based authentication system with role-based access control (RBAC).

### Access Levels

1. **Public** - No authentication required
   - View events, teams, sites, fields (read-only)
   - Submit facility/equipment requests

2. **Authenticated (admin/mgmt)** - JWT token required
   - All CRUD operations on events, teams, sites, fields, equipment
   - Manage requests (approve/deny)
   - View and update all data

3. **Admin Only** - Admin role required
   - Create new users
   - Manage user accounts

---

## Database Setup

### 1. Run the Updated Schema

Execute the updated `database-schema.sql` which now includes the `users` table:

```sql
CREATE TABLE users (
  id INT PRIMARY KEY IDENTITY(1,1),
  username NVARCHAR(255) NOT NULL UNIQUE,
  password_hash NVARCHAR(255) NOT NULL,
  role NVARCHAR(50) NOT NULL CHECK (role IN ('admin', 'mgmt', 'user')),
  email NVARCHAR(255),
  full_name NVARCHAR(255),
  is_active BIT DEFAULT 1,
  created_at DATETIME DEFAULT GETDATE(),
  updated_at DATETIME DEFAULT GETDATE()
);
```

### 2. Default Users

The schema includes two default users:

| Username | Password | Role | Purpose |
|----------|----------|------|---------|
| QMTadmin | Renegades!1982 | admin | Full system access |
| manager1 | Renegades!1982 | mgmt | Management operations |

**⚠️ CRITICAL: Change these passwords immediately after deployment!**

---

## API Endpoints

### Authentication Endpoints (Public)

#### `POST /api/auth/login`
Login and receive JWT token.

**Request:**
```json
{
  "username": "QMTadmin",
  "password": "Renegades!1982"
}
```

**Response:**
```json
{
  "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "user": {
    "id": 1,
    "username": "QMTadmin",
    "role": "admin",
    "email": "admin@renegades.ch",
    "fullName": "Administrator"
  }
}
```

#### `POST /api/auth/register` (Admin only)
Create a new user account.

**Headers:**
```
Authorization: Bearer <admin-token>
```

**Request:**
```json
{
  "username": "coach1",
  "password": "SecurePassword123",
  "role": "mgmt",
  "email": "coach@renegades.ch",
  "fullName": "John Doe"
}
```

#### `GET /api/auth/me`
Get current user information.

**Headers:**
```
Authorization: Bearer <token>
```

#### `POST /api/auth/change-password`
Change user password.

**Headers:**
```
Authorization: Bearer <token>
```

**Request:**
```json
{
  "currentPassword": "OldPassword123",
  "newPassword": "NewPassword456"
}
```

---

### Public Endpoints (No Auth Required)

#### Events
- `GET /api/events` - List all events
- `GET /api/events/:id` - Get single event

#### Teams
- `GET /api/teams` - List all teams
- `GET /api/teams/:id` - Get single team

#### Sites
- `GET /api/sites` - List all sites
- `GET /api/sites/:id` - Get single site

#### Fields
- `GET /api/fields` - List all fields
- `GET /api/fields/:id` - Get single field

#### Requests
- `POST /api/requests` - Submit a request (facility, equipment, cancellation)

---

### Protected Endpoints (Admin/Mgmt Only)

All CREATE, UPDATE, DELETE operations require authentication and admin/mgmt role.

**Headers Required:**
```
Authorization: Bearer <token>
```

#### Events
- `POST /api/events` - Create event
- `PUT /api/events/:id` - Update event
- `DELETE /api/events/:id` - Delete event

#### Teams
- `POST /api/teams` - Create team
- `PUT /api/teams/:id` - Update team
- `DELETE /api/teams/:id` - Delete team

#### Sites
- `POST /api/sites` - Create site
- `PUT /api/sites/:id` - Update site
- `DELETE /api/sites/:id` - Delete site

#### Fields
- `POST /api/fields` - Create field
- `PUT /api/fields/:id` - Update field
- `DELETE /api/fields/:id` - Delete field

#### Equipment
- `GET /api/equipment` - List equipment
- `POST /api/equipment` - Create equipment
- `PUT /api/equipment/:id` - Update equipment
- `DELETE /api/equipment/:id` - Delete equipment

#### Requests
- `GET /api/requests` - List all requests
- `GET /api/requests/:id` - Get request details
- `PUT /api/requests/:id` - Update request (approve/deny)
- `DELETE /api/requests/:id` - Delete request

---

## Frontend Integration

### Using the API Client

The frontend API client (`src/lib/api.ts`) automatically handles tokens:

```typescript
import { api, setToken, setStoredUser, removeToken } from '@/lib/api';

// Login
try {
  const response = await api.login('QMTadmin', 'Renegades!1982');
  setToken(response.token);
  setStoredUser(response.user);
  console.log('Logged in:', response.user);
} catch (error) {
  console.error('Login failed:', error.message);
}

// Make authenticated requests (token added automatically)
const teams = await api.getTeams();
await api.createEvent({ /* event data */ });

// Logout
removeToken();
```

### Protected Routes in React

The `OperationsOffice` component already checks user permissions. The login flow is:

1. User clicks "Operations Office" on Dashboard
2. `LoginDialog` opens
3. User enters credentials
4. On success, token is stored and `OperationsOffice` opens
5. All API calls from Operations Office include the JWT token

---

## Environment Configuration

### Development (.env)

```env
DB_SERVER=qmt.database.windows.net
DB_NAME=renegadesdb
DB_USER=QMTmgmt
DB_PASSWORD=your_password

JWT_SECRET=dev-secret-key-change-in-production
NODE_ENV=development
PORT=3000
```

### Production (Azure App Service)

Add these application settings in Azure Portal:

```
JWT_SECRET=<generate-a-strong-random-secret>
NODE_ENV=production
PORT=8080
```

**Generate a secure JWT_SECRET:**
```bash
node -e "console.log(require('crypto').randomBytes(64).toString('hex'))"
```

---

## Security Best Practices

### ✅ Implemented

- ✅ Passwords hashed with bcrypt (cost factor 10)
- ✅ JWT tokens with 24-hour expiration
- ✅ Role-based access control (admin, mgmt, user)
- ✅ Token validation on protected routes
- ✅ SQL injection prevention (parameterized queries)
- ✅ No credentials in source code
- ✅ HTTPS encryption (Azure enforces)

### ⚠️ Recommended Enhancements

- [ ] **Refresh tokens** for extended sessions
- [ ] **Rate limiting** on login endpoint (prevent brute force)
- [ ] **Password complexity requirements** (min length, special chars)
- [ ] **Account lockout** after failed login attempts
- [ ] **Password reset flow** via email
- [ ] **Audit logging** for sensitive operations
- [ ] **Two-factor authentication** (2FA)
- [ ] **Token blacklist** for logout functionality
- [ ] **CORS configuration** for production domain only

---

## Testing Authentication

### 1. Test Login (curl)

```bash
# Login
curl -X POST http://localhost:3000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"username":"QMTadmin","password":"Renegades!1982"}'

# Save the token from response
TOKEN="<your-token-here>"
```

### 2. Test Protected Endpoint

```bash
# Without token (should fail with 401)
curl http://localhost:3000/api/equipment

# With token (should succeed)
curl http://localhost:3000/api/equipment \
  -H "Authorization: Bearer $TOKEN"
```

### 3. Test Public Endpoint

```bash
# Should work without token
curl http://localhost:3000/api/events
```

### 4. Test Role-Based Access

```bash
# Create new user (requires admin token)
curl -X POST http://localhost:3000/api/auth/register \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN" \
  -d '{
    "username": "newuser",
    "password": "SecurePass123",
    "role": "mgmt",
    "email": "user@example.com"
  }'
```

---

## User Management

### Creating Additional Users

Only admins can create users. Use the Operations Office or API:

```typescript
await api.register({
  username: 'coach2',
  password: 'SecurePassword123',
  role: 'mgmt',
  email: 'coach2@renegades.ch',
  fullName: 'Jane Smith'
});
```

### Deactivating Users

Update the `is_active` flag in the database:

```sql
UPDATE users SET is_active = 0 WHERE username = 'olduser';
```

### Changing User Roles

```sql
UPDATE users SET role = 'admin' WHERE username = 'manager1';
```

---

## Troubleshooting

### "Access token required" Error
- Token not included in request
- Check `Authorization: Bearer <token>` header

### "Invalid or expired token" Error
- Token expired (24 hours)
- Login again to get new token
- Check JWT_SECRET matches between environments

### "Admin or management privileges required" Error
- User role is 'user' but endpoint requires 'admin' or 'mgmt'
- Check user role in database

### "Account is inactive" Error
- User's `is_active` flag is set to 0
- Activate user in database

### Login Works but API Calls Fail
- Token not being sent with requests
- Check browser localStorage for `auth_token`
- Verify API client is using `getToken()` function

---

## Migration from Old Auth System

The old frontend auth system (`src/lib/auth.ts`) has been replaced. Update any components still using:

**Old:**
```typescript
import { authenticateUser } from '@/lib/auth';
const user = authenticateUser(username, password);
```

**New:**
```typescript
import { api, setToken, setStoredUser } from '@/lib/api';
const response = await api.login(username, password);
setToken(response.token);
setStoredUser(response.user);
```

---

## Production Deployment Checklist

- [ ] Run updated `database-schema.sql` in Azure SQL
- [ ] Generate and set strong `JWT_SECRET` in Azure App Service
- [ ] Change default admin password immediately
- [ ] Verify firewall rules for Azure SQL
- [ ] Test login endpoint: `/api/auth/login`
- [ ] Test protected endpoint with token
- [ ] Test public endpoints without token
- [ ] Configure CORS for production domain
- [ ] Enable Application Insights for monitoring
- [ ] Set up alerts for failed login attempts
- [ ] Document admin credentials in secure location (password manager)

---

## Support

For issues or questions:
1. Check Application Insights logs
2. Review API endpoint documentation above
3. Test with curl commands
4. Verify token in browser DevTools → Application → Local Storage
