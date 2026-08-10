import fs from 'fs';

const HASURA_URL = 'http://localhost:8080/v1/metadata';
const ADMIN_SECRET = 'myadminsecretkey';

async function req(type, args) {
  const res = await fetch(HASURA_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Hasura-Admin-Secret': ADMIN_SECRET,
    },
    body: JSON.stringify({
      type,
      args
    }),
  });
  const data = await res.json();
  if (!res.ok) {
    console.error(`Error in ${type}:`, data);
  } else {
    console.log(`Success: ${type}`);
  }
}

async function run() {
  const tables = [
    { name: 'organizations', schema: 'public' },
    { name: 'org_members', schema: 'public' },
    { name: 'workflows', schema: 'public' },
    { name: 'workflow_steps', schema: 'public' },
    { name: 'workflow_triggers', schema: 'public' },
    { name: 'workflow_runs', schema: 'public' },
    { name: 'step_runs', schema: 'public' },
    { name: 'users', schema: 'auth' },
  ];

  for (const table of tables) {
    await req('pg_track_table', {
      source: 'default',
      table: { schema: table.schema, name: table.name }
    });
  }

  // Create Relationships
  const rels = [
    // org_members
    { type: 'pg_create_object_relationship', args: { source: 'default', table: 'org_members', name: 'org', using: { foreign_key_constraint_on: 'org_id' } } },
    { type: 'pg_create_object_relationship', args: { source: 'default', table: 'org_members', name: 'user', using: { foreign_key_constraint_on: 'user_id' } } },
    
    // organizations
    { type: 'pg_create_array_relationship', args: { source: 'default', table: 'organizations', name: 'members', using: { foreign_key_constraint_on: { table: 'org_members', column: 'org_id' } } } },
    { type: 'pg_create_array_relationship', args: { source: 'default', table: 'organizations', name: 'workflows', using: { foreign_key_constraint_on: { table: 'workflows', column: 'org_id' } } } },
    
    // workflows
    { type: 'pg_create_object_relationship', args: { source: 'default', table: 'workflows', name: 'org', using: { foreign_key_constraint_on: 'org_id' } } },
    { type: 'pg_create_array_relationship', args: { source: 'default', table: 'workflows', name: 'steps', using: { foreign_key_constraint_on: { table: 'workflow_steps', column: 'workflow_id' } } } },
    { type: 'pg_create_array_relationship', args: { source: 'default', table: 'workflows', name: 'triggers', using: { foreign_key_constraint_on: { table: 'workflow_triggers', column: 'workflow_id' } } } },
    { type: 'pg_create_array_relationship', args: { source: 'default', table: 'workflows', name: 'runs', using: { foreign_key_constraint_on: { table: 'workflow_runs', column: 'workflow_id' } } } },
    
    // workflow_steps
    { type: 'pg_create_object_relationship', args: { source: 'default', table: 'workflow_steps', name: 'workflow', using: { foreign_key_constraint_on: 'workflow_id' } } },
    { type: 'pg_create_array_relationship', args: { source: 'default', table: 'workflow_steps', name: 'runs', using: { foreign_key_constraint_on: { table: 'step_runs', column: 'workflow_step_id' } } } },
    
    // workflow_triggers
    { type: 'pg_create_object_relationship', args: { source: 'default', table: 'workflow_triggers', name: 'workflow', using: { foreign_key_constraint_on: 'workflow_id' } } },
    
    // workflow_runs
    { type: 'pg_create_object_relationship', args: { source: 'default', table: 'workflow_runs', name: 'workflow', using: { foreign_key_constraint_on: 'workflow_id' } } },
    { type: 'pg_create_array_relationship', args: { source: 'default', table: 'workflow_runs', name: 'step_runs', using: { foreign_key_constraint_on: { table: 'step_runs', column: 'workflow_run_id' } } } },
    
    // step_runs
    { type: 'pg_create_object_relationship', args: { source: 'default', table: 'step_runs', name: 'run', using: { foreign_key_constraint_on: 'workflow_run_id' } } },
    { type: 'pg_create_object_relationship', args: { source: 'default', table: 'step_runs', name: 'step', using: { foreign_key_constraint_on: 'workflow_step_id' } } },
  ];

  for (const rel of rels) {
    await req(rel.type, rel.args);
  }

  // Permissions
  // Everyone uses role "user", which maps to the app's standard logged-in user.
  // The actual access logic checks org_members table for owner/editor/viewer.
  
  const ownerOrEditorCheck = {
    "_and": [
      { "org": { "members": { "user_id": { "_eq": "X-Hasura-User-Id" } } } },
      { "org": { "members": { "role": { "_in": ["owner", "editor"] } } } }
    ]
  };

  const viewerCheck = {
    "org": { "members": { "user_id": { "_eq": "X-Hasura-User-Id" } } }
  };

  const ownerOnlyCheck = {
    "_and": [
      { "org": { "members": { "user_id": { "_eq": "X-Hasura-User-Id" } } } },
      { "org": { "members": { "role": { "_eq": "owner" } } } }
    ]
  };

  // 1. workflows: select (viewer+), insert/update/delete (owner/editor)
  await req('pg_create_select_permission', {
    source: 'default', table: 'workflows', role: 'user',
    permission: { columns: '*', filter: viewerCheck }
  });
  await req('pg_create_insert_permission', {
    source: 'default', table: 'workflows', role: 'user',
    permission: { check: ownerOrEditorCheck, set: {}, columns: ['name', 'description', 'org_id'] }
  });
  await req('pg_create_update_permission', {
    source: 'default', table: 'workflows', role: 'user',
    permission: { check: ownerOrEditorCheck, filter: ownerOrEditorCheck, columns: ['name', 'description'] }
  });
  await req('pg_create_delete_permission', {
    source: 'default', table: 'workflows', role: 'user',
    permission: { filter: ownerOrEditorCheck }
  });

  // 2. workflow_steps:
  // Custom Check: Only owners can add webhook, notify, db_write
  const stepInsertCheck = {
    "_and": [
      { "workflow": { "org": { "members": { "user_id": { "_eq": "X-Hasura-User-Id" } } } } },
      { "workflow": { "org": { "members": { "role": { "_in": ["owner", "editor"] } } } } },
      {
        "_or": [
          { "type": { "_nin": ["webhook", "notify", "db_write"] } },
          { "workflow": { "org": { "members": { "role": { "_eq": "owner" } } } } }
        ]
      }
    ]
  };

  const stepSelectCheck = { "workflow": { "org": { "members": { "user_id": { "_eq": "X-Hasura-User-Id" } } } } };

  await req('pg_create_select_permission', {
    source: 'default', table: 'workflow_steps', role: 'user',
    permission: { columns: '*', filter: stepSelectCheck }
  });
  await req('pg_create_insert_permission', {
    source: 'default', table: 'workflow_steps', role: 'user',
    permission: { check: stepInsertCheck, columns: '*' }
  });
  await req('pg_create_update_permission', {
    source: 'default', table: 'workflow_steps', role: 'user',
    permission: { check: stepInsertCheck, filter: stepInsertCheck, columns: ['position', 'type', 'config'] }
  });
  await req('pg_create_delete_permission', {
    source: 'default', table: 'workflow_steps', role: 'user',
    permission: { filter: { "workflow": ownerOrEditorCheck } }
  });

  // 3. workflow_triggers (same owner-only for webhook)
  const triggerInsertCheck = {
    "_and": [
      { "workflow": { "org": { "members": { "user_id": { "_eq": "X-Hasura-User-Id" } } } } },
      { "workflow": { "org": { "members": { "role": { "_in": ["owner", "editor"] } } } } },
      {
        "_or": [
          { "type": { "_nin": ["webhook"] } },
          { "workflow": { "org": { "members": { "role": { "_eq": "owner" } } } } }
        ]
      }
    ]
  };

  await req('pg_create_select_permission', {
    source: 'default', table: 'workflow_triggers', role: 'user',
    permission: { columns: '*', filter: { "workflow": viewerCheck } }
  });
  await req('pg_create_insert_permission', {
    source: 'default', table: 'workflow_triggers', role: 'user',
    permission: { check: triggerInsertCheck, columns: '*' }
  });
  await req('pg_create_delete_permission', {
    source: 'default', table: 'workflow_triggers', role: 'user',
    permission: { filter: { "workflow": ownerOrEditorCheck } }
  });

  // 4. workflow_runs & step_runs (select only for users, mutations handled by Action)
  await req('pg_create_select_permission', {
    source: 'default', table: 'workflow_runs', role: 'user',
    permission: { columns: '*', filter: { "workflow": viewerCheck } }
  });
  await req('pg_create_select_permission', {
    source: 'default', table: 'step_runs', role: 'user',
    permission: { columns: '*', filter: { "run": { "workflow": viewerCheck } } }
  });

  // 5. organizations (select)
  await req('pg_create_select_permission', {
    source: 'default', table: 'organizations', role: 'user',
    permission: { columns: '*', filter: { "members": { "user_id": { "_eq": "X-Hasura-User-Id" } } } }
  });

  // 6. org_members (select)
  await req('pg_create_select_permission', {
    source: 'default', table: 'org_members', role: 'user',
    permission: { columns: '*', filter: { "org": { "members": { "user_id": { "_eq": "X-Hasura-User-Id" } } } } }
  });
  
  // Custom Actions
  await req('create_action', {
    name: 'triggerWorkflowRun',
    definition: {
      handler: 'http://host.docker.internal:3000/api/hasura/trigger',
      forward_client_headers: true,
      kind: 'synchronous',
      arguments: [{ name: 'workflow_id', type: 'uuid!' }],
      output_type: 'TriggerResponse',
    }
  });

  await req('set_custom_types', {
    custom_types: {
      objects: [
        { name: 'TriggerResponse', fields: [{ name: 'run_id', type: 'uuid!' }, { name: 'status', type: 'String!' }] },
        { name: 'ApproveResponse', fields: [{ name: 'success', type: 'Boolean!' }] }
      ]
    }
  });

  await req('create_action', {
    name: 'approveStep',
    definition: {
      handler: 'http://host.docker.internal:3000/api/hasura/approve',
      forward_client_headers: true,
      kind: 'synchronous',
      arguments: [{ name: 'step_run_id', type: 'uuid!' }, { name: 'approved', type: 'Boolean!' }],
      output_type: 'ApproveResponse',
    }
  });

  // Allow 'user' to execute these actions
  await req('create_action_permission', {
    action: 'triggerWorkflowRun',
    role: 'user'
  });
  await req('create_action_permission', {
    action: 'approveStep',
    role: 'user'
  });

  console.log("Hasura setup complete!");
}

run();
