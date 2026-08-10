import fs from 'fs';

const HASURA_URL = 'http://localhost:8080/v1/metadata';
const ADMIN_SECRET = 'myadminsecretkey';

async function req(type, args) {
  const res = await fetch(HASURA_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'X-Hasura-Admin-Secret': ADMIN_SECRET },
    body: JSON.stringify({ type, args })
  });
  console.log(type, await res.json());
}

async function run() {
  await req('set_custom_types', {
    objects: [
      { name: 'TriggerResponse', fields: [{ name: 'run_id', type: 'uuid!' }, { name: 'status', type: 'String!' }] },
      { name: 'ApproveResponse', fields: [{ name: 'success', type: 'Boolean!' }] }
    ]
  });

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

  await req('create_action_permission', { action: 'triggerWorkflowRun', role: 'user' });
  await req('create_action_permission', { action: 'approveStep', role: 'user' });
}

run();
