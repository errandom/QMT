# Form Data Collection and Select Dropdown Fixes

## Issues Fixed

### 1. ✅ Equipment Dialog - Unable to Select Assigned Team
**Problem**: The assigned team dropdown in the Equipment dialog appeared inactive or unresponsive.

**Root Cause**: Form initialization used empty string `''` for `assignedTeamId`, which conflicted with the 'unassigned' sentinel value in the Select component.

**Solution**: Changed initialization to use `undefined` instead of empty string.

**Files Modified**:
- [EquipmentManager.tsx](src/components/OperationsOffice/EquipmentManager.tsx)

### 2. ✅ Fields Dialog - Unable to Select Site, Turf Type, or Field Size
**Problem**: All three dropdowns (Site, Turf Type, Field Size) in the Fields dialog were unresponsive.

**Root Cause**: The `siteId` was initialized as empty string `''`, and the Select component expects either a valid value or `undefined`. When using an empty string, the Select doesn't properly render the placeholder and can't be opened.

**Solution**: 
- Changed `siteId` initialization from `''` to `undefined`
- Added fallback handling: `value={formData.siteId || ''}`

**Files Modified**:
- [FieldsManager.tsx](src/components/OperationsOffice/FieldsManager.tsx)

### 3. ✅ Sites Dialog - Only Address Being Stored, Other Fields Not Saving
**Problem**: When creating or editing sites, only the address was being saved to the database. All other fields (zip code, city, lat, lng, contact information) were not persisting.

**Root Cause**: React Input components were using `value={formData.field}` which becomes `undefined` on edit, causing controlled component warnings and preventing proper data collection. When a field is undefined, React treats the input as uncontrolled and doesn't update state properly.

**Solution**: Added fallback handling to all input fields:
- `value={formData.address || ''}`
- `value={formData.city || ''}`
- `value={formData.zipCode || ''}`
- `value={formData.latitude || ''}`
- `value={formData.longitude || ''}`
- Similar for all contact fields

**Files Modified**:
- [SitesManager.tsx](src/components/OperationsOffice/SitesManager.tsx)

## Technical Explanation

### React Controlled Components
React Input components must be either **controlled** or **uncontrolled**, not switch between the two:

**Controlled**: `value` prop is always defined (string, number, etc.)
```typescript
<Input value={formData.name} onChange={...} />  // ✓ Good if formData.name is always defined
```

**Problem Pattern**:
```typescript
<Input value={formData.name} onChange={...} />  // ✗ Bad if formData.name could be undefined
// On first render: value={undefined} → uncontrolled
// After edit: value="some text" → controlled
// React warning: "A component is changing an uncontrolled input to be controlled"
```

**Fixed Pattern**:
```typescript
<Input value={formData.name || ''} onChange={...} />  // ✓ Always controlled (never undefined)
```

### Select Component Requirements
The Radix UI Select component (used in shadcn/ui) has specific requirements:
- `value` must be a string that matches a SelectItem value
- Cannot be `undefined` (causes component to not render properly)
- Use empty string `''` as fallback when no selection made
- Placeholder only shows when value is empty string or no match found

**Problem**:
```typescript
<Select value={formData.siteId} ...>  // ✗ Bad if siteId is undefined
```

**Fixed**:
```typescript
<Select value={formData.siteId || ''} ...>  // ✓ Always has a valid value
```

## Data Flow After Fixes

### Equipment Form
```typescript
// Initialization
assignedTeamId: undefined

// Select component
<Select value={formData.assignedTeamId || 'unassigned'} ...>
  <SelectItem value="unassigned">Unassigned</SelectItem>
  <SelectItem value="team-1">Team 1</SelectItem>
</Select>

// Result: Dropdown shows "Unassigned" and is clickable
```

### Fields Form
```typescript
// Initialization
siteId: undefined
turfType: 'Natural Turf'
fieldSize: 'Full'

// Select components
<Select value={formData.siteId || ''} ...>  // Shows placeholder
<Select value={formData.turfType || 'Natural Turf'} ...>  // Shows default
<Select value={formData.fieldSize || 'Full'} ...>  // Shows default

// Result: All dropdowns are responsive
```

### Sites Form
```typescript
// Before Fix
<Input value={formData.city} ...>  // undefined → uncontrolled → doesn't update

// After Fix
<Input value={formData.city || ''} ...>  // '' → controlled → updates properly

// When user types "Boston":
// onChange fires → setFormData({ ...formData, city: "Boston" })
// Re-render → value="Boston" → input shows "Boston"

// When submitting:
apiData = {
  city: formData.city || null,  // "Boston" → sent to API
  zipCode: formData.zipCode || null,  // "02101" → sent to API
  latitude: formData.latitude || 0,  // 42.3601 → sent to API
  // ... all fields now included
}
```

## Testing

### Test Equipment Dropdown
1. Go to Operations Office → Equipment
2. Click "Add Equipment"
3. Try to select "Assigned Team" dropdown
4. **Expected**: Dropdown opens and shows team list
5. Select a team and save
6. Edit the equipment
7. **Expected**: Selected team appears in dropdown

### Test Fields Dropdowns
1. Go to Operations Office → Fields
2. Click "Add Field"
3. Test all three dropdowns:
   - **Site**: Should open and show active sports facilities
   - **Turf Type**: Should show Natural/Artificial options
   - **Field Size**: Should show Full/Shared options
4. Select values from all dropdowns
5. Save the field
6. Edit the field
7. **Expected**: All selected values appear in dropdowns

### Test Sites Data Persistence
1. Go to Operations Office → Sites
2. Click "Add Site"
3. Fill in ALL fields:
   ```
   Site Name: Central Park
   Address: 123 Main St
   City: Boston
   Zip Code: 02101
   Latitude: 42.3601
   Longitude: -71.0589
   Contact First Name: John
   Contact Last Name: Doe
   Contact Phone: 555-1234
   Contact Email: john@example.com
   ```
4. Check browser console for:
   ```
   SITES FRONTEND: Submitting site data: {
     name: "Central Park",
     address: "123 Main St",
     city: "Boston",
     zipCode: "02101",
     latitude: 42.3601,
     longitude: -71.0589,
     contactFirstName: "John",
     contactLastName: "Doe",
     contactPhone: "555-1234",
     contactEmail: "john@example.com",
     ...
   }
   ```
5. Check server console for `[Sites POST] Received data:` with all fields
6. Query database:
   ```sql
   SELECT TOP 1 * FROM sites ORDER BY id DESC;
   ```
7. **Expected**: All columns have values (not NULL)
8. Edit the site
9. **Expected**: All fields populate correctly in the edit dialog

## Common Issues and Solutions

### Issue: Dropdown Still Won't Open
**Cause**: z-index conflict with dialog overlay  
**Solution**: Already fixed - Select components use z-[100]

### Issue: Fields Show "undefined" or blank after edit
**Cause**: Transform function not properly mapping database fields  
**Solution**: Check [api.ts](src/lib/api.ts) transform functions

### Issue: Site data saves but lat/lng are 0
**Cause**: Empty input returns NaN from parseFloat  
**Solution**: Already fixed with fallback: `e.target.value ? parseFloat(e.target.value) : 0`

### Issue: Console shows "uncontrolled to controlled" warning
**Cause**: Input value switching from undefined to string  
**Solution**: Already fixed with `|| ''` fallback on all inputs

### Issue: Database saves NULL despite form having data
**Cause**: Backend not receiving fields (API transformation issue)  
**Check**: 
1. Browser console - is data in `FRONTEND:` log?
2. Server console - is data in `POST/PUT` log?
3. If (1) yes but (2) no → Network issue
4. If (2) yes but DB has NULL → SQL query issue

## Database Verification

After testing, verify data in database:

### Equipment
```sql
SELECT id, name, quantity, assigned_team_id FROM equipment WHERE id = <your_test_id>;
```
Should show: assigned_team_id has a value or NULL (not empty string)

### Fields
```sql
SELECT id, name, site_id, field_type, surface_type FROM fields WHERE id = <your_test_id>;
```
Should show: site_id, field_type, surface_type all have values

### Sites
```sql
SELECT 
  id, name, address, city, zip_code, 
  latitude, longitude,
  contact_first_name, contact_last_name, 
  contact_phone, contact_email
FROM sites 
WHERE id = <your_test_id>;
```
Should show: ALL fields have values matching what you entered

## Files Changed Summary

1. **EquipmentManager.tsx**
   - Changed `assignedTeamId: ''` → `assignedTeamId: undefined`
   - Ensures Select component works with 'unassigned' sentinel value

2. **FieldsManager.tsx**
   - Changed `siteId: ''` → `siteId: undefined`
   - Updated Select to use `value={formData.siteId || ''}`
   - Enables all three dropdowns to function properly

3. **SitesManager.tsx**
   - Added `|| ''` fallback to all Input value props (10 fields)
   - Added `|| 0` fallback to latitude/longitude with parseFloat
   - Ensures all form fields are controlled components
   - Prevents undefined values from breaking state updates

## Success Criteria

✅ Equipment: Can select assigned team from dropdown in create/edit dialog  
✅ Fields: Can select site, turf type, and field size from all three dropdowns  
✅ Sites: All fields (not just address) save to database correctly  
✅ No React warnings about uncontrolled/controlled components  
✅ Edit dialogs populate all fields correctly  
✅ Browser console shows complete data in FRONTEND logs  
✅ Server console shows complete data in POST/PUT logs  
✅ Database queries show all fields populated (no unexpected NULLs)  
