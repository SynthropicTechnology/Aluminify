## ADDED Requirements

### Requirement: The system SHALL provide a public API to list active subscription plans
The system SHALL expose a public GET endpoint that returns active plans for display on the pricing page, without requiring authentication.

#### Scenario: Fetch active plans
- **WHEN** a GET request is made to `/api/plans`
- **THEN** the system SHALL return all plans where `active = true`
- **AND** SHALL order results by `display_order` ascending
- **AND** SHALL include: name, slug, description, features, monthly price, yearly price, limits, is_featured, badge_text

#### Scenario: Response format
- **WHEN** plans are returned
- **THEN** each plan SHALL include prices in cents and a formatted display value
- **AND** SHALL NOT include Stripe IDs or internal fields
- **AND** the free plan (if exists) SHALL be included with `price_monthly_cents = 0`

#### Scenario: No active plans
- **WHEN** no plans are active
- **THEN** the system SHALL return an empty array
- **AND** SHALL NOT return an error

### Requirement: The pricing page SHALL display plans dynamically from the database
The pricing page SHALL fetch plans from the public API instead of using hardcoded data.

#### Scenario: Initial page load
- **WHEN** the pricing page loads
- **THEN** it SHALL fetch plans from `/api/plans`
- **AND** SHALL display a loading skeleton while fetching
- **AND** SHALL render plan cards once data is available

#### Scenario: Plan card display
- **WHEN** plans are rendered
- **THEN** each card SHALL show: plan name, description, price, billing interval, features list
- **AND** the featured plan SHALL be visually highlighted
- **AND** badge text (if set) SHALL be displayed on the card

### Requirement: The pricing page SHALL support billing interval toggle
The pricing page SHALL allow users to switch between monthly and yearly billing views.

#### Scenario: Monthly/yearly toggle
- **WHEN** the user toggles between monthly and yearly billing
- **THEN** plan prices SHALL update to reflect the selected interval
- **AND** yearly prices SHALL show the per-month equivalent and total annual cost
- **AND** plans without yearly pricing SHALL display only the monthly price

### Requirement: The pricing page SHALL initiate checkout
The pricing page SHALL direct users to the appropriate flow based on the plan type selected.

#### Scenario: Subscribe button for paid plans
- **WHEN** a visitor clicks "Assinar" on a paid plan
- **THEN** the system SHALL initiate the Stripe Checkout Session flow
- **AND** SHALL pass the selected plan and billing interval

#### Scenario: Free plan signup
- **WHEN** a visitor clicks the action button on the free plan
- **THEN** the system SHALL redirect to the registration page
- **AND** SHALL NOT initiate a Stripe Checkout

#### Scenario: Custom/Enterprise plan
- **WHEN** a visitor clicks the action button on an enterprise plan
- **THEN** the system SHALL redirect to a contact form or WhatsApp link
- **AND** SHALL NOT initiate a Stripe Checkout

### Requirement: The pricing page SHALL handle error states
The pricing page SHALL gracefully handle API failures and empty states.

#### Scenario: API fetch failure
- **WHEN** the plans API request fails
- **THEN** the pricing page SHALL display a user-friendly error message
- **AND** SHALL offer a retry option

#### Scenario: Empty plans list
- **WHEN** no plans are returned from the API
- **THEN** the pricing page SHALL display a fallback message (e.g., "Planos em breve")
