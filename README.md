# Vocallabs SDE Assignment

## Project Overview
This project is an AI-powered Workflow Builder designed for multi-tenant organizations. It allows organizations to define, execute, and monitor multi-step workflows with real-time feedback. Workflows support features like LLM processing, HTTP requests, conditional branching, approval gates, and notifications.

## Architecture & Tech Stack
- **Frontend**: Next.js 15, React 19, Tailwind CSS, Apollo Client
- **Backend API**: Next.js App Router API Routes (`/api/*`)
- **Database**: PostgreSQL 15
- **GraphQL Engine**: Hasura 2.36.0 (handles schema, subscriptions, and RBAC permissions)
- **Authentication**: Custom JWT based Auth via Next.js API

## Database & Schema Overview
The PostgreSQL database consists of several core tables to support multi-tenancy and workflows:
- `organizations`: Holds organization limits (e.g., usage limits).
- `org_members`: Links users to organizations with roles (`owner`, `editor`, `viewer`).
- `workflows`: Contains the workflow metadata.
- `workflow_steps`: Configuration and ordering of steps (`llm_call`, `http_request`, `conditional_branch`, etc.).
- `workflow_triggers`: Defines how workflows are initiated (e.g., `manual`, `webhook`).
- `workflow_runs` & `step_runs`: Tracks execution state, history, and input/outputs.

## Two Permission Layers (Security)
The application enforces strict data isolation and security through two primary layers:
1. **Org Isolation (Layer 1)**: Utilizing Hasura's Row-Level Security (RLS), users can only read or mutate data belonging to their respective organizations. An `owner` in Org A cannot access or guess the IDs of workflows in Org B.
2. **Action Validation (Layer 2)**: Complex mutations like triggering workflows or approving a paused step run are routed through Hasura Custom Actions to our Next.js backend. The backend strictly verifies the user's role (`owner` or `editor`) and their organization membership before modifying state or interacting with external services.

## Authentication
Authentication is handled via a custom Next.js endpoint (`/api/auth/login`). It accepts an email address, checks if the user exists in the database, and issues a JWT compatible with Hasura (`x-hasura-allowed-roles`, `x-hasura-user-id`). For demonstration purposes, if the email does not exist, a new user account is automatically provisioned.

## Workflow Execution & Features
- **Workflow Execution**: A background executor (`src/lib/executor.ts`) sequentially processes steps in a workflow. It manages data passing between steps (the output of step N becomes the input of step N+1).
- **Approval Gate**: If an `approval_gate` step is encountered, the executor pauses the workflow run and updates the state. An authorized user (`owner` or `editor`) must manually approve or reject the step to resume execution.
- **Retry Logic**: If a step fails (e.g., due to an external API failure), the executor implements an automatic retry mechanism with exponential backoff (up to 3 attempts) before failing the entire run.
- **Quota Handling**: Organization usage limits are strictly enforced upon triggering a workflow. If an organization exceeds its `usage_limit`, execution is denied.
- **Webhook Trigger**: Workflows can be triggered externally via a webhook endpoint (`/api/webhook`), passing the `workflow_id` and an Authorization Bearer token.
- **GraphQL Subscriptions**: The dashboard leverages Apollo Client and Hasura GraphQL Subscriptions to provide real-time updates of a workflow run's progress.

## Local Setup

### Environment Variables
Create a `.env.local` file in the root directory:
```env
HASURA_GRAPHQL_ENDPOINT=http://localhost:8080/v1/graphql
HASURA_ADMIN_SECRET=
JWT_SECRET=
GEMINI_API_KEY=your-gemini-api-key # Optional, falls back to stub responses if "stub"
```
*(Never expose actual secrets in source control. The values above correspond to the local docker-compose environment).*

### How to Run
1. Start the infrastructure (PostgreSQL, Hasura):
   ```bash
   docker compose up -d
   ```
2. Apply Hasura schema, metadata, and seed data:
   ```bash
   node setup_hasura.mjs
   ```
3. Install dependencies:
   ```bash
   npm install
   ```
4. Start the Next.js development server:
   ```bash
   npm run dev
   ```
5. Open [http://localhost:3000](http://localhost:3000)

## How to Test the Final Scenario
1. **Login**: Sign in as the seeded user `orga-owner@test.com`.
2. **Explore**: Notice that you only see Org A's workflows. You are securely isolated from Org B.
3. **Run Workflow**: Trigger a workflow manually via the UI.
4. **Live Subscription**: Observe the real-time status updates as steps execute.
5. **Approval**: When the workflow pauses at an `approval_gate`, click the "Approve & Resume" button to continue execution.
6. **Webhook Trigger**: Trigger a workflow programmatically by sending a POST request to `http://localhost:3000/api/webhook` with `{"workflow_id": "<uuid>"}` and the JWT in the `Authorization: Bearer <token>` header.
7. **Cross-Org Test**: Log out and log in as `orgb-owner@test.com`. Observe complete data isolation—Org A's workflows are completely hidden.
