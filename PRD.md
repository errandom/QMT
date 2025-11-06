# Planning Guide

A modern, glossy facility management system for the Zurich Renegades Football club, managing both tackle and flag football operations with a sleek navy blue aesthetic reflecting the city of Zurich. The interface uses a powerful athletic font (Bebas Neue) for headers and maintains a professional, sports-focused design.

**Experience Qualities**: 
1. **Modern & Glossy** - Contemporary design with smooth shapes, subtle gradients, and premium feel
2. **Intuitive** - Clear visual hierarchy with sport-specific iconography (gridiron for facilities, helmet for tackle football) and easy navigation
3. **Professional** - Polished interface that reflects the quality of Zurich Renegades organization with strong, powerful typography

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
- **Functionality**: Full CRUD interface for all database tables with card-based navigation
- **Purpose**: Enable staff to manage all system data with clear visual organization
- **Trigger**: Successful authentication and navigation to management section
- **Progression**: User authenticates → Operations Office loads with card-based menu → Selects section via card click → Views records in table → Creates/edits/deletes records as needed
- **Success criteria**: All sections accessible via cards (Schedule with calendar icon, Requests with action icon, Teams with player icon, Fields with gridiron icon, Sites with arena icon), CRUD operations work, data validates properly, QMTmgmt cannot access user management, no horizontal scrolling required

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
The typeface should convey modern athleticism and power with strong, bold headers using Bebas Neue for impact, while maintaining readability for data with Inter for body content - creating a commanding presence appropriate for sports operations.

- **Typographic Hierarchy**: 
  - H1 (Page Titles): Bebas Neue Bold/48px/tight letter spacing (0.02em)
  - H2 (Section Headers): Bebas Neue Regular/32px/tight letter spacing (0.02em)
  - H3 (Card Titles): Inter Bold/18px/normal letter spacing
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
  - Toggle Group (sport type filter with custom gridiron and helmet icons)
  - Select (team dropdown with consistent h-14 height)
  - Button (CTAs with h-14 height for all action buttons - requests and management)
  - Dialog (request forms and login modal)
  - Card (schedule events display and management section navigation cards)
  - Table (management view using shadcn Table with sortable headers)
  - Form (all input handling via react-hook-form integration)
  - Tabs (management section content switching)
  - Input, Textarea, Select (form fields with consistent styling)
  - Alert (success/error notifications using sonner toast)
  - Badge (sport type indicators and status labels)

- **Customizations**: 
  - Custom GridironIcon component for facility and field indicators
  - Custom HelmetIcon component for tackle football indicators
  - Schedule event cards with color-coded sport type borders
  - Management section with card-based navigation (prevents horizontal scrolling)
  - Card-based menu for Operations Office with icons
  - Custom authentication dialog with role indicator

- **States**: 
  - Buttons: Default solid fill → Hover with subtle lift and brightness increase → Active with scale-down → Disabled with 50% opacity
  - Inputs: Default with subtle border → Focus with ring and border color shift → Error with red border and shake animation
  - Toggle Group: Unselected muted background → Selected with primary color and icon highlight
  - Cards: Default flat → Hover with subtle shadow elevation

- **Icon Selection**: 
  - CalendarBlank (schedule/date fields)
  - ListChecks (requests and action items)
  - Users (teams and user management)
  - GridironIcon (custom - fields and facility requests, all sports toggle)
  - HelmetIcon (custom - tackle football indicator)
  - Buildings (sites/arena locations)
  - MapPin (site/field location on event cards)
  - Clipboard (equipment requests)
  - ShieldCheck (management section access)
  - Plus (add new records)
  - PencilSimple (edit records)
  - Trash (delete records)
  - SignOut (logout from management)

- **Spacing**: 
  - Container padding: p-6 (24px)
  - Card padding: p-4 (16px)
  - Section gaps: gap-8 (32px) for major sections, gap-4 (16px) for related elements
  - Button spacing: px-6 py-3 for primary, px-4 py-2 for secondary
  - Form field spacing: space-y-4 between fields
  - Table cell padding: px-4 py-3

- **Mobile**: 
  - Dashboard: Sport toggles remain in 3-column grid, action buttons (All Teams dropdown, Request Facility, Request Equipment, Management Section) stack vertically with full width and consistent h-14 height
  - Management: Card-based navigation wraps to 2 columns on mobile, tables become scrollable horizontally within their containers
  - Operations Office: Cards stack in 2-column grid on mobile, 3 columns on tablet, 6 columns on desktop
  - Dialogs: Form fields stack vertically at full width
  - Responsive breakpoint: 768px (md in Tailwind)
