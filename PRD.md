# Planning Guide

A modern, glossy facility management system for the Zurich Renegades Football club, managing both tackle and flag football operations with a sleek navy blue aesthetic reflecting the city of Zurich.

**Experience Qualities**: 
1. **Modern & Glossy** - Contemporary design with smooth shapes, subtle gradients, and premium feel
2. **Intuitive** - Clear visual hierarchy with sport-specific iconography and easy navigation
3. **Professional** - Polished interface that reflects the quality of Zurich Renegades organization

**Complexity Level**: Light Application (multiple features with basic state)
  - Dashboard with sport type toggle and team filtering
  - Public event schedule with zero-state handling
  - Authentication with user state display
  - Facility and equipment request forms
  - Management console for administrators

## Essential Features

### Public Dashboard
- **Functionality**: Display upcoming events from schedule with team/site/field information
- **Purpose**: Provide transparent, public access to facility schedules
- **Trigger**: Landing page load
- **Progression**: User lands → Views upcoming events → Filters by sport type (all/tackle/flag) → Optionally filters by team → Views filtered schedule
- **Success criteria**: Events display correctly with proper filtering, sport type icons visible, data updates in real-time

### Sport Type Filtering
- **Functionality**: Toggle between all sports, tackle football only, or flag football only
- **Purpose**: Allow users to focus on specific sport categories
- **Trigger**: User clicks sport type toggle buttons
- **Progression**: User selects sport type → Dashboard filters events → Only matching events display with appropriate icons
- **Success criteria**: Filtering works instantly, appropriate helmet icons display, toggle states are clear

### Team Selection
- **Functionality**: Dropdown to filter schedule by specific team or all teams
- **Purpose**: Enable users to quickly find their team's schedule
- **Trigger**: User opens team dropdown
- **Progression**: User clicks dropdown → Selects team or "All Teams" → Schedule filters to show only selected team's events
- **Success criteria**: All teams listed, filtering accurate, "All Teams" resets filter

### Facility Request
- **Functionality**: Form to submit facility usage requests
- **Purpose**: Streamline facility booking process
- **Trigger**: User clicks "Request Facility" button
- **Progression**: User clicks button → Form dialog opens → Fills in team, site, field, date/time → Submits → Confirmation message → Request saved
- **Success criteria**: Form validates inputs, saves to requests table, provides feedback

### Equipment Request
- **Functionality**: Form to submit equipment requests
- **Purpose**: Track and manage equipment needs
- **Trigger**: User clicks "Request Equipment" button
- **Progression**: User clicks button → Form dialog opens → Fills in equipment details → Submits → Confirmation message → Request saved
- **Success criteria**: Form validates inputs, saves to requests table, provides feedback

### Authentication
- **Functionality**: Role-based login system with two roles (QMTadmin, QMTmgmt)
- **Purpose**: Protect management features and restrict user management to admins
- **Trigger**: User clicks "Management Section" button
- **Progression**: User clicks button → Login dialog appears → Enters credentials → System validates → Grants access based on role → Management view loads
- **Success criteria**: Credentials validate correctly, appropriate permissions applied, session persists

### Management Dashboard
- **Functionality**: Full CRUD interface for all database tables
- **Purpose**: Enable staff to manage all system data
- **Trigger**: Successful authentication and navigation to management section
- **Progression**: User authenticates → Management view loads → Selects table via toggle → Views records in table → Creates/edits/deletes records as needed
- **Success criteria**: All tables accessible, CRUD operations work, data validates properly, QMTmgmt cannot access user management

### Data Tables Management
- **Functionality**: Individual views for Teams, Sites, Fields, Schedule, Requests, Users
- **Purpose**: Organize data management by entity type
- **Trigger**: User selects table toggle in management view
- **Progression**: User clicks table toggle → Records load and display → User can add new record, edit existing, or delete → Changes save → Confirmation provided
- **Success criteria**: All fields editable, relationships maintained (schedule references fields, fields reference sites), validation prevents invalid data

## Edge Case Handling
- **Empty Schedule**: Display friendly message when no upcoming events exist
- **Invalid Login**: Show clear error message for incorrect credentials, limit retry attempts
- **Missing Relationships**: Prevent orphaned records (can't delete site if fields reference it)
- **Duplicate Requests**: Allow duplicate requests but timestamp each uniquely
- **Unauthorized Access**: Redirect to login if attempting to access management without authentication
- **Session Expiry**: Prompt re-authentication after reasonable timeout period
- **Network Errors**: Display user-friendly messages when operations fail

## Design Direction
The design should evoke a premium, modern Swiss aesthetic with glossy surfaces, smooth rounded shapes, and a sophisticated navy blue color palette representing Zurich's professionalism and class - think sleek, contemporary sports facility with subtle depth and dimensionality.

## Color Selection
Analogous (adjacent colors on the color wheel) - Using navy blue as the foundation with lighter blues to create a cohesive Zurich-inspired palette that feels elegant and trustworthy.

- **Primary Color**: Navy Blue (oklch(0.32 0.12 240)) - Deep, sophisticated navy representing Zurich's professional sports culture
- **Secondary Colors**: 
  - Sky Blue (oklch(0.65 0.14 235)) - Bright, energetic blue for accents and active states
  - Steel Blue (oklch(0.48 0.08 240)) - Mid-tone blue for secondary elements
- **Accent Color**: Cyan Blue (oklch(0.72 0.15 220)) - Vibrant highlight for CTAs and important interactions
- **Foreground/Background Pairings**:
  - Background (Light Blue Gray oklch(0.97 0.01 240)): Navy text (oklch(0.25 0.1 240)) - Ratio 9.1:1 ✓
  - Card (White oklch(0.99 0 0)): Navy text (oklch(0.25 0.1 240)) - Ratio 10.2:1 ✓
  - Primary (Navy oklch(0.32 0.12 240)): White text (oklch(0.99 0 0)) - Ratio 7.8:1 ✓
  - Secondary (Sky Blue oklch(0.65 0.14 235)): Dark text (oklch(0.2 0.08 240)) - Ratio 6.4:1 ✓
  - Accent (Cyan oklch(0.72 0.15 220)): Dark text (oklch(0.2 0.08 240)) - Ratio 7.9:1 ✓
  - Muted (Blue Gray oklch(0.92 0.02 240)): Medium text (oklch(0.45 0.08 240)) - Ratio 5.2:1 ✓

## Font Selection
The typeface should convey modern athleticism with clean geometric forms for the dashboard while maintaining readability for dense data tables in management - Inter provides this versatility with its excellent legibility at all sizes.

- **Typographic Hierarchy**: 
  - H1 (Page Titles): Inter Bold/32px/tight letter spacing (-0.02em)
  - H2 (Section Headers): Inter SemiBold/24px/normal letter spacing
  - H3 (Card Titles): Inter Medium/18px/normal letter spacing
  - Body (General Text): Inter Regular/16px/relaxed line height (1.6)
  - Small (Metadata): Inter Regular/14px/normal line height (1.5)
  - Caption (Table Headers): Inter Medium/12px/uppercase/wide letter spacing (0.05em)

## Animations
Animations should emphasize transitions between filtered states and provide satisfying feedback for user actions while remaining subtle enough not to distract from the data-focused management interface.

- **Purposeful Meaning**: 
  - Sport type toggles pulse briefly when selected to reinforce the filter change
  - Schedule items fade in/out smoothly when filters change
  - Request forms slide in from the right to create spatial continuity
  - Management table rows highlight on hover to indicate interactivity
  - Success confirmations use gentle scale-in animations

- **Hierarchy of Movement**: 
  - Primary: Filter toggles and request submissions (immediate feedback)
  - Secondary: Schedule updates and data table interactions
  - Tertiary: Hover states and minor UI responses

## Component Selection
- **Components**: 
  - Toggle Group (sport type filter with custom helmet icons)
  - Select (team dropdown with search functionality)
  - Button (CTAs with size variants: default for requests, sm for table actions)
  - Dialog (request forms and login modal)
  - Card (schedule events display with shadcn Card component)
  - Table (management view using shadcn Table with sortable headers)
  - Form (all input handling via react-hook-form integration)
  - Tabs (management section table navigation)
  - Input, Textarea, Select (form fields with consistent styling)
  - Alert (success/error notifications using sonner toast)
  - Badge (sport type indicators and status labels)

- **Customizations**: 
  - Custom helmet icon components for tackle/flag football indicators
  - Schedule event cards with color-coded sport type borders
  - Management table with inline editing capabilities
  - Custom authentication dialog with role indicator

- **States**: 
  - Buttons: Default solid fill → Hover with subtle lift and brightness increase → Active with scale-down → Disabled with 50% opacity
  - Inputs: Default with subtle border → Focus with ring and border color shift → Error with red border and shake animation
  - Toggle Group: Unselected muted background → Selected with primary color and icon highlight
  - Cards: Default flat → Hover with subtle shadow elevation

- **Icon Selection**: 
  - Plus (add new records)
  - PencilSimple (edit records)
  - Trash (delete records)
  - CalendarBlank (schedule/date fields)
  - MapPin (site/field location)
  - Users (teams)
  - FootballHelmet (tackle football - custom or from available set)
  - Flag (flag football indicator)
  - MagnifyingGlass (search/filter)
  - SignOut (logout from management)
  - Check (form submission success)

- **Spacing**: 
  - Container padding: p-6 (24px)
  - Card padding: p-4 (16px)
  - Section gaps: gap-8 (32px) for major sections, gap-4 (16px) for related elements
  - Button spacing: px-6 py-3 for primary, px-4 py-2 for secondary
  - Form field spacing: space-y-4 between fields
  - Table cell padding: px-4 py-3

- **Mobile**: 
  - Dashboard: Sport toggles stack vertically, cards take full width, team dropdown expands to full width
  - Management: Tables become scrollable horizontally, action buttons group in dropdown menu
  - Dialogs: Form fields stack vertically at full width
  - Navigation: Hamburger menu for management table selection
  - Responsive breakpoint: 768px (md in Tailwind)
