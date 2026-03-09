# Subscription Plans Management Specification

## Plan CRUD (Superadmin)

### Requirement: The superadmin SHALL be able to create subscription plans

#### Scenario: Create a new plan
- **WHEN** the superadmin submits a new plan form
- **THEN** the system SHALL create a Stripe Product via the API
- **AND** SHALL create one or two Stripe Prices (monthly, optionally yearly)
- **AND** SHALL store the plan in `subscription_plans` with Stripe IDs
- **AND** SHALL set `active = true` by default

#### Scenario: Plan creation with required fields
- **WHEN** creating a plan
- **THEN** the system SHALL require: name, slug (unique), monthly price, currency
- **AND** SHALL validate slug uniqueness before creating
- **AND** yearly price, features, limits, and display options SHALL be optional

#### Scenario: Plan creation failure rollback
- **WHEN** the Stripe API call succeeds but the database insert fails
- **THEN** the system SHALL log the inconsistency for manual resolution
- **AND** SHALL return an error to the superadmin

### Requirement: The superadmin SHALL be able to edit subscription plans

#### Scenario: Edit plan metadata
- **WHEN** the superadmin updates plan name, description, features, or limits
- **THEN** the system SHALL update the Stripe Product metadata
- **AND** SHALL update the `subscription_plans` row

#### Scenario: Edit plan price
- **WHEN** the superadmin changes the price of a plan
- **THEN** the system SHALL create a new Stripe Price (prices are immutable in Stripe)
- **AND** SHALL archive the old Stripe Price
- **AND** SHALL update `stripe_price_id_monthly` or `stripe_price_id_yearly` in `subscription_plans`
- **AND** existing subscriptions SHALL remain on the old price until renewal

### Requirement: The superadmin SHALL be able to deactivate plans

#### Scenario: Deactivate a plan
- **WHEN** the superadmin deactivates a plan
- **THEN** the system SHALL set `active = false` in `subscription_plans`
- **AND** SHALL archive the Stripe Prices (set `active = false`)
- **AND** the plan SHALL NOT appear on the pricing page
- **AND** existing subscriptions on this plan SHALL NOT be affected

---

## Subscription Overview (Superadmin)

### Requirement: The superadmin SHALL have visibility over all tenant subscriptions

#### Scenario: List all subscriptions
- **WHEN** the superadmin accesses the subscriptions page
- **THEN** the system SHALL display all subscriptions with: tenant name, plan name, status, billing interval, next payment date, amount

#### Scenario: Filter subscriptions
- **WHEN** the superadmin applies filters
- **THEN** the system SHALL support filtering by: status (active, past_due, canceled, unpaid), plan, and tenant name search

#### Scenario: View subscription detail
- **WHEN** the superadmin selects a subscription
- **THEN** the system SHALL show: full subscription history, payment history, current usage vs plan limits

### Requirement: The superadmin SHALL be able to manage tenant subscriptions

#### Scenario: Cancel a tenant's subscription
- **WHEN** the superadmin cancels a subscription
- **THEN** the system SHALL call Stripe API to cancel the subscription
- **AND** the webhook SHALL update the local database

#### Scenario: Change a tenant's plan
- **WHEN** the superadmin changes a tenant's plan
- **THEN** the system SHALL call Stripe API to update the subscription items
- **AND** Stripe SHALL handle proration automatically
- **AND** the webhook SHALL update the local database

---

## Tenant Plan Management

### Requirement: Tenants SHALL be able to view and manage their subscription

#### Scenario: View current plan
- **WHEN** a tenant admin accesses the plan settings page
- **THEN** the system SHALL display: plan name, status, billing interval, next payment date, price
- **AND** SHALL show current usage vs limits (students, courses, storage)

#### Scenario: Manage subscription via portal
- **WHEN** a tenant admin clicks "Gerenciar Assinatura"
- **THEN** the system SHALL redirect to the Stripe Customer Portal
- **AND** the portal SHALL allow: upgrade, downgrade, cancel, update payment method

#### Scenario: Upgrade from pricing comparison
- **WHEN** a tenant admin clicks "Fazer Upgrade"
- **THEN** the system SHALL show available plans with feature comparison
- **AND** clicking a plan SHALL initiate a Checkout Session or Portal update flow

#### Scenario: Usage limit alerts
- **WHEN** a tenant reaches 80% of any plan limit
- **THEN** the system SHALL display a warning on the plan settings page
- **WHEN** a tenant reaches 100% of a limit
- **THEN** the system SHALL display an error with upgrade CTA

---

## Plan Limit Enforcement

### Requirement: The system SHALL enforce plan limits

#### Scenario: Student limit reached
- **WHEN** a tenant attempts to create a new active student
- **AND** the tenant has reached `max_active_students` for their plan
- **THEN** the system SHALL block the operation
- **AND** SHALL return a clear error message with upgrade CTA

#### Scenario: Course limit reached
- **WHEN** a tenant attempts to create a new course
- **AND** the tenant has reached `max_courses` for their plan
- **THEN** the system SHALL block the operation
- **AND** SHALL return a clear error message with upgrade CTA

#### Scenario: Module access restriction
- **WHEN** a tenant attempts to access a module not in their plan's `allowed_modules`
- **THEN** the system SHALL show a locked state with upgrade CTA

#### Scenario: Grace period for past due subscriptions
- **WHEN** a subscription is in `past_due` status
- **THEN** the system SHALL allow continued access for a configurable grace period
- **WHEN** the grace period expires
- **THEN** the system SHALL restrict access to read-only mode

#### Scenario: Free plan (no subscription)
- **WHEN** a tenant has no active subscription
- **THEN** the system SHALL apply default free-tier limits
- **AND** SHALL allow basic functionality without payment
