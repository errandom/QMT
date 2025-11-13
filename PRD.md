# Planning Guide

A comprehensive facility and event management system for the Zurich Renegades American Football club that provides public event visibility with advanced scheduling capabilities and a restricted operations office for administrative management of teams, facilities, equipment, and requests.

**Experience Qualities**:
1. **Professional** - The interface must convey organizational competence and operational efficiency befitting a sports organization managing multiple teams and facilities.
2. **Intuitive** - Complex data relationships (sites, fields, teams, events) must be immediately understandable through clear visual hierarchy and logical grouping.
3. **Fluid** - Transitions between public dashboard and operations office, between list and schedule views, should feel seamless and purposeful.

**Complexity Level**: Complex Application (advanced functionality, accounts)
  - This application manages multiple interconnected entities (sites, fields, teams, events, equipment), features role-based authentication (admin/mgmt), supports CRUD operations, includes both public and restricted views, and handles recurring events with sophisticated scheduling visualization.

## Essential Features

### Public Dashboard - Event Calendar
- **Functionality**: Display upcoming events (practices, games, meetings, other) with comprehensive details including weather forecasts, team info, coaches, and location amenities
- **Purpose**: Provide transparent visibility into club activities for players, families, and stakeholders
- **Trigger**: Default landing page view
- **Progression**: Page load → Event list displays → User filters by sport/team → Events update → User toggles to schedule view → Weekly grid visualization → User clicks event → Detail modal opens
- **Success criteria**: Events display correctly filtered, weather shows for events <5 days out, schedule view renders time blocks accurately

### Sport & Team Filtering
- **Functionality**: Toggle between All Sports/Tackle Football/Flag Football with cascading team dropdown
- **Purpose**: Allow users to focus on relevant activities for specific programs
- **Trigger**: User clicks sport toggle or team dropdown
- **Progression**: User selects sport → Team dropdown updates with relevant teams → Event list filters → Results display
- **Success criteria**: Teams filter correctly based on sport selection, "All Sports" shows all active teams

### Facility Request (Public)
- **Functionality**: Form to request facility access with requestor info, event type, teams, date/time, duration
- **Purpose**: Enable coaches and organizers to formally request field time
- **Trigger**: Click "Facility" button in header
- **Progression**: Button click → Dialog opens → User fills mandatory fields (name, phone, type, date, time) → For game/practice: team required → Add optional description → Submit → Toast confirmation → Request appears in Operations Office
- **Success criteria**: Mandatory validation works, 90-min default for game/practice, submission creates request record

### Equipment Request (Public)
- **Functionality**: Form to request equipment with team selection, date, and description
- **Purpose**: Track and manage equipment needs across teams
- **Trigger**: Click "Equipment" button in header
- **Progression**: Button click → Dialog opens → User selects team(s) → Specifies date → Describes equipment need → Submit → Confirmation → Request logged
- **Success criteria**: Team selection mandatory, creates retrievable request record

### Schedule View Toggle
- **Functionality**: Switch between detailed event list and compact weekly schedule organized by site/field
- **Purpose**: Provide visual overview of facility utilization across time
- **Trigger**: User clicks view toggle
- **Progression**: Toggle click → View transitions → Schedule displays sites vertically → Time blocks (17:00-22:00) horizontally → 30-min increments → Team bars span duration → Hover shows detail
- **Success criteria**: Time blocks align correctly, events don't overlap visually, Monday-Friday shown, current planning period displayed

### Event Cancellation Request
- **Functionality**: Button on events >36hrs in future (status Confirmed or Planned) to request cancellation with detailed form
- **Purpose**: Allow stakeholders to formally request event cancellation with proper justification
- **Trigger**: Click "Request Cancellation" on event card
- **Progression**: Button click → Dialog opens → User enters name, phone, justification → Submit → Request logged → Appears in Operations Office
- **Success criteria**: Button only appears when >36hrs out and event status is Confirmed or Planned, validates required fields, creates reviewable request in Operations Office

### Event Status Auto-Update
- **Functionality**: Automatically updates events from Planned to Confirmed status when <24hrs from start
- **Purpose**: Ensure no events remain in Planned status close to start time
- **Trigger**: System checks on page load/refresh
- **Progression**: Event list loads → System checks each Planned event → If <24hrs away → Status changes to Confirmed → Display updates
- **Success criteria**: No Planned events exist within 24hrs of start time, status updates persist across sessions

### Authentication & Authorization
- **Functionality**: Login dialog with role-based access (admin/mgmt only for Operations Office)
- **Purpose**: Secure administrative functions while keeping public calendar open
- **Trigger**: Click "Office" button or attempt to access restricted route
- **Progression**: Office click → Login dialog → User enters credentials → Role verified → Operations Office displays with appropriate permissions
- **Success criteria**: Unauthorized users blocked, admin sees user management, mgmt/admin access all CRUD functions

### Operations Office - Schedule Management
- **Functionality**: Create, edit, delete events with full detail including recurring patterns
- **Purpose**: Central control point for all club scheduling
- **Trigger**: Navigate to Schedule section in Operations Office
- **Progression**: Section loads → Events list displays → Create button → Form opens → Select type, date, time, teams, field, status → Option for recurring → Set weekdays and date range → Save → Events created → Public calendar updates
- **Success criteria**: Recurring events generate correctly, only active fields shown, validation prevents conflicts

### Operations Office - Site Management
- **Functionality**: CRUD operations for sports facilities with address, contact info, amenities
- **Purpose**: Maintain accurate facility database with location and feature data
- **Trigger**: Navigate to Sites section
- **Progression**: Section loads → Sites list → Create/Edit → Enter name, address, coordinates, contact, amenities → Toggle active status → Save → Cascades to related fields if deactivated
- **Success criteria**: Inactive sites hide from field selection, lat/long stored for weather, amenities display on event cards

### Operations Office - Field Management
- **Functionality**: CRUD operations for fields linked to sites with turf type, lighting, capacity
- **Purpose**: Track individual playing surfaces and their characteristics
- **Trigger**: Navigate to Fields section
- **Progression**: Section loads → Fields list → Create/Edit → Select parent site → Enter name, turf type, lights, size, capacity → Toggle active → Save → Field available for event assignment
- **Success criteria**: Fields only assignable to active sites, features display correctly on events

### Operations Office - Team Management
- **Functionality**: CRUD operations for teams with sport type, coaches, managers, roster size
- **Purpose**: Organize club's multiple teams across two sports with contact information
- **Trigger**: Navigate to Teams section
- **Progression**: Section loads → Teams list grouped by sport → Create/Edit → Enter name, sport type, coach/manager details, roster size → Toggle active → Save
- **Success criteria**: Active/inactive status filters event assignments, coach/manager display on relevant events

### Operations Office - Equipment Management
- **Functionality**: Track equipment inventory and assignments
- **Purpose**: Manage shared resources across teams
- **Trigger**: Navigate to Equipment section
- **Progression**: Section loads → Equipment list → Create/Edit → Enter details → Assign to team → Track status
- **Success criteria**: Equipment trackable, assignment history maintained

### Operations Office - Request Management
- **Functionality**: Review facility and equipment requests with approve/reject workflow
- **Purpose**: Process incoming requests with audit trail
- **Trigger**: Navigate to Requests section (notification badge if unreviewed)
- **Progression**: Section loads → Requests list (pending highlighted) → Click request → Review details → Approve or Reject → Action timestamp and user recorded → Request struck through → Audit trail preserved
- **Success criteria**: Notification clears when all reviewed, requests cannot be deleted, history immutable

### User Management (Admin Only)
- **Functionality**: Create users, assign roles, set active/inactive status
- **Purpose**: Control access to Operations Office
- **Trigger**: Admin navigates to Settings → User Management
- **Progression**: Section loads → Users list → Create → Enter username, password, assign role → Save → User can login
- **Success criteria**: Only admin sees this section, roles enforce correctly, default user QMTadmin with password Renegades!1982 exists

## Edge Case Handling

- **Network Failures**: Optimistic UI updates with rollback on error, retry mechanisms for failed saves
- **Concurrent Edits**: Last-write-wins with timestamp tracking, conflict indication in UI
- **Invalid Dates**: Validation prevents past dates for new events, warn when scheduling conflicts exist
- **Missing Relations**: Prevent orphaned fields (site deleted), cascade deactivations, validate references before save
- **Empty States**: Helpful prompts in Operations Office when no entities exist ("Create your first site"), encourage action
- **Weather API Limits**: Cache forecasts, graceful degradation if service unavailable
- **Long Event Lists**: Virtual scrolling in list view, pagination in schedule view by week
- **Mobile Constraints**: Simplified schedule view on mobile (swipe between days), condensed event cards

## Design Direction

The design should evoke professionalism and operational precision while maintaining approachability—this is a sports club, not a military operation. The glossy, modern aesthetic should feel like premium sports management software with a Swiss sensibility: clean, precise, and efficient. The navy-to-light-blue gradient represents the club's identity and Zurich's connection to water and sky, creating visual interest without distraction. The interface should balance information density (many data points per event) with breathing room (not overwhelming), using cards and clear hierarchy. Think modern SaaS dashboard meets sports team management.

## Color Selection

Analogous color scheme centered on navy blue, transitioning through lighter blues to represent Zurich and water/sky, creating a cohesive, professional sports brand identity.

- **Primary Color**: Navy Blue (oklch(0.35 0.08 250)) - Conveys authority, professionalism, and team identity; used for primary actions and header
- **Secondary Colors**: 
  - Bright Azure (oklch(0.65 0.15 240)) - Supporting interactive elements, represents Zurich's lake
  - Light Sky Blue (oklch(0.85 0.08 240)) - Subtle backgrounds, represents openness and clarity
- **Accent Color**: Vivid Blue (oklch(0.55 0.18 245)) - Highlights, CTAs, focus states, draws attention to key actions
- **Foreground/Background Pairings**:
  - Background (White oklch(0.98 0 0)): Navy foreground (oklch(0.25 0.08 250)) - Ratio 10.2:1 ✓
  - Card (Light Gray oklch(0.97 0.005 240)): Navy foreground (oklch(0.25 0.08 250)) - Ratio 9.8:1 ✓
  - Primary (Navy oklch(0.35 0.08 250)): White text (oklch(0.98 0 0)) - Ratio 8.5:1 ✓
  - Secondary (Bright Azure oklch(0.65 0.15 240)): Navy text (oklch(0.25 0.08 250)) - Ratio 5.2:1 ✓
  - Accent (Vivid Blue oklch(0.55 0.18 245)): White text (oklch(0.98 0 0)) - Ratio 5.8:1 ✓
  - Muted (Light Sky Blue oklch(0.85 0.08 240)): Navy text (oklch(0.25 0.08 250)) - Ratio 6.5:1 ✓

## Font Selection

The typeface should convey modern professionalism with excellent readability at various sizes, as this application displays dense information (schedules, forms, data tables). Inter is chosen for its geometric clarity, designed specifically for UI legibility, and its Swiss design heritage aligns perfectly with the Zurich Renegades identity.

- **Typographic Hierarchy**:
  - H1 (Main Title "QMT | Operations"): Inter Bold / 24px / -0.02em tracking / leading-tight
  - H2 (Section Headers "Schedule", "Requests"): Inter Semibold / 20px / -0.01em / leading-snug
  - H3 (Event Titles, Card Headers): Inter Semibold / 16px / normal / leading-normal
  - Body (Event Details, Forms): Inter Regular / 14px / normal / leading-relaxed
  - Small (Metadata, Timestamps): Inter Medium / 12px / normal / leading-normal
  - Labels (Form Labels, Tags): Inter Medium / 13px / 0.01em / leading-none

## Animations

Animations should be purposeful and swift, reinforcing the professional sports management context—think efficient, precise movements rather than playful flourishes. Motion guides attention to state changes (event status updates, request approvals) and smooths transitions between complex views (list to schedule, public to office).

- **Purposeful Meaning**: 
  - Fade + slide for dialog/modal entry (authority, focus)
  - Color pulse for status changes (planned → confirmed)
  - Smooth height transitions for collapsible sections
  - Subtle scale on hover for interactive elements (approachability)
  
- **Hierarchy of Movement**: 
  1. Critical: Status changes, form submission feedback
  2. Important: View transitions (list ↔ schedule), navigation
  3. Enhancing: Hover states, card elevation, filter updates

## Component Selection

- **Components**: 
  - Dialog: Facility/equipment requests, login, event details, confirmation prompts
  - Card: Event cards (public), entity cards (operations), navigation cards (office home)
  - Form with react-hook-form: All CRUD operations, request submissions
  - Tabs: Operations Office navigation between 6 sections
  - Select: Team dropdown, field selection, site selection, enum values
  - Switch: Active/inactive toggles, sport type toggle
  - Button: Primary (submit, approve), Secondary (cancel, back), Destructive (reject, delete)
  - Badge: Event status (planned/confirmed/cancelled), sport type, request status
  - Separator: Visual grouping in forms and cards
  - Tooltip: Feature explanations, icon labels in compact schedule
  - Avatar: User profile in header when logged in
  - Alert: Empty states, error states, success confirmations
  - Calendar: Date picker for events and requests
  - Checkbox: Multi-select teams, amenities, features, weekdays for recurring
  - Textarea: Notes, descriptions, equipment details
  - Input: Text fields across all forms
  - Label: Form field labels with required indicators
  - Toast (sonner): Action feedback (request submitted, event created, approval confirmed)

- **Customizations**: 
  - Weekly schedule grid: Custom component with time axis (horizontal) and site/field rows (vertical), colored bars for events
  - Event card: Custom layout showing status, weather, teams, coaches, location with amenities
  - Navigation header: Custom with title, login state, user avatar
  - Request review card: Custom with approval workflow buttons

- **States**: 
  - Buttons: Default, hover (scale 1.02), active (scale 0.98), disabled (opacity 50%), loading (spinner)
  - Inputs: Default, focus (ring-2 ring-accent), error (ring-destructive), disabled
  - Cards: Default, hover (subtle shadow increase), selected (ring accent)
  - Events in schedule: Default, hover (tooltip), conflict (red tint)

- **Icon Selection**: 
  - CalendarBlank: Events, schedule
  - MapPin: Location, sites
  - Users: Teams, coaches
  - Cube: Equipment
  - ClipboardText: Requests
  - Gear: Settings
  - SignIn/SignOut: Authentication
  - Plus: Create actions
  - PencilSimple: Edit
  - Trash: Delete
  - Check/X: Approve/reject
  - CaretDown: Dropdowns
  - FunnelSimple: Filters
  - Lightning: Field features (lights)
  - Info: Tooltips

- **Spacing**: 
  - Section padding: p-6 (desktop), p-4 (mobile)
  - Card padding: p-4
  - Form field spacing: gap-4
  - Card grid gap: gap-4
  - Inline elements: gap-2
  - Page margins: max-w-7xl mx-auto

- **Mobile**: 
  - Navigation: Sticky header with hamburger menu for Operations Office sections
  - Event cards: Stack all info vertically, expand amenities on tap
  - Schedule view: Single day at a time with horizontal swipe
  - Forms: Full-width inputs, larger touch targets (min 44px)
  - Tables: Horizontal scroll or card transformation for lists
  - Filters: Sheet/drawer from bottom for sport/team selection
