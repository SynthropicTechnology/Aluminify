# Stripe Integration Specification

## Stripe Client

### Requirement: The system SHALL provide a singleton Stripe client for server-side operations

#### Scenario: Stripe client initialization
- **WHEN** any server-side code requires Stripe API access
- **THEN** it SHALL use the singleton client from `stripe.service.ts`
- **AND** the client SHALL be initialized with `STRIPE_SECRET_KEY` from validated environment variables
- **AND** the client SHALL NOT be importable from client-side code

---

## Checkout Sessions

### Requirement: The system SHALL create Stripe Checkout Sessions for subscription purchases

#### Scenario: Tenant initiates subscription checkout
- **WHEN** an authenticated user requests a checkout for a plan
- **THEN** the system SHALL verify the user has admin role for the tenant
- **AND** SHALL create or retrieve a Stripe Customer using the tenant's admin email
- **AND** SHALL store the `stripe_customer_id` in the `empresas` table
- **AND** SHALL create a Checkout Session with `mode: 'subscription'`
- **AND** SHALL set `metadata.empresa_id` and `metadata.plan_id` on the session
- **AND** SHALL return the session URL for redirect

#### Scenario: Checkout with existing Stripe Customer
- **WHEN** the tenant already has a `stripe_customer_id` in `empresas`
- **THEN** the system SHALL reuse the existing Stripe Customer
- **AND** SHALL NOT create a duplicate customer

#### Scenario: Checkout session price selection
- **WHEN** the user selects monthly billing
- **THEN** the system SHALL use `stripe_price_id_monthly` from the plan
- **WHEN** the user selects yearly billing
- **THEN** the system SHALL use `stripe_price_id_yearly` from the plan

---

## Billing Portal

### Requirement: The system SHALL provide access to Stripe Customer Portal for subscription management

#### Scenario: Tenant opens billing portal
- **WHEN** an authenticated tenant admin requests to manage their subscription
- **THEN** the system SHALL create a Billing Portal Session using the tenant's `stripe_customer_id`
- **AND** SHALL set `return_url` to the tenant's plan settings page
- **AND** SHALL return the portal URL for redirect

#### Scenario: Tenant without Stripe Customer
- **WHEN** a tenant without `stripe_customer_id` attempts to access the portal
- **THEN** the system SHALL return an error indicating no active subscription

---

## Webhook Handler

### Requirement: The system SHALL process Stripe webhook events to maintain subscription state

#### Scenario: Webhook signature validation
- **WHEN** a POST request arrives at `/api/webhooks/stripe`
- **THEN** the system SHALL validate the `stripe-signature` header using `stripe.webhooks.constructEvent()`
- **AND** SHALL use `STRIPE_WEBHOOK_SECRET` for validation
- **AND** SHALL return 400 if signature is invalid
- **AND** SHALL read the raw request body (not parsed JSON) for signature verification

#### Scenario: checkout.session.completed event
- **WHEN** the webhook receives a `checkout.session.completed` event with `mode: 'subscription'`
- **THEN** the system SHALL extract `empresa_id` and `plan_id` from session metadata
- **AND** SHALL create a new `subscriptions` row with the Stripe subscription ID
- **AND** SHALL update `empresas.subscription_id` and `empresas.plano` to match the plan
- **AND** SHALL set subscription status to `active`

#### Scenario: invoice.paid event
- **WHEN** the webhook receives an `invoice.paid` event for a subscription
- **THEN** the system SHALL update `subscriptions.last_payment_date`
- **AND** SHALL update `current_period_start` and `current_period_end`
- **AND** SHALL ensure subscription status is `active`

#### Scenario: invoice.payment_failed event
- **WHEN** the webhook receives an `invoice.payment_failed` event
- **THEN** the system SHALL set `subscriptions.status` to `past_due`

#### Scenario: customer.subscription.updated event
- **WHEN** the webhook receives a `customer.subscription.updated` event
- **THEN** the system SHALL update the subscription's `plan_id` if the price changed (upgrade/downgrade)
- **AND** SHALL update `billing_interval`, `status`, and period dates
- **AND** SHALL update `empresas.plano` to reflect the new plan tier

#### Scenario: customer.subscription.deleted event
- **WHEN** the webhook receives a `customer.subscription.deleted` event
- **THEN** the system SHALL set `subscriptions.status` to `canceled`
- **AND** SHALL set `subscriptions.canceled_at` to the current timestamp

### Requirement: Webhook processing SHALL be idempotent

#### Scenario: Duplicate webhook event
- **WHEN** the same webhook event is received more than once
- **THEN** the system SHALL check if the event has already been processed using `stripe_subscription_id`
- **AND** SHALL NOT create duplicate records
- **AND** SHALL return 200 OK without error

### Requirement: Webhook handler SHALL return appropriate HTTP responses

#### Scenario: Successful processing
- **WHEN** an event is processed successfully
- **THEN** the system SHALL return HTTP 200 with `{ received: true }`

#### Scenario: Unhandled event type
- **WHEN** an event type is not in the handled set
- **THEN** the system SHALL return HTTP 200 (acknowledge receipt) without processing

#### Scenario: Processing error
- **WHEN** an error occurs during event processing
- **THEN** the system SHALL log the error with event details
- **AND** SHALL return HTTP 500 to trigger Stripe retry
