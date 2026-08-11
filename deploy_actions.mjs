import fs from 'fs';

const HASURA_METADATA_URL = 'https://select-satyr-95.hasura.app/v1/metadata';
const ADMIN_SECRET = 'Wm6QDGSNlVgcNZVUhXVOPg4xMU3yEk18jcBcpZwgyEBdSRfWIehKmKAwezw2o9GN';

async function reqMeta(type, args) {
  const res = await fetch(HASURA_METADATA_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'X-Hasura-Admin-Secret': ADMIN_SECRET },
    body: JSON.stringify({ type, args })
  });
  const data = await res.json();
  if (!res.ok) {
    console.error(`Error in ${type}:`, JSON.stringify(data, null, 2));
    throw new Error('Metadata action failed');
  }
  else console.log(`Success: ${type}`);
  return data;
}

async function deployActions() {
  console.log("=== Setting up Actions ===");
  try {
    await reqMeta('set_custom_types', { objects: [ { name: 'TriggerResponse', fields: [{ name: 'run_id', type: 'uuid!' }, { name: 'status', type: 'String!' }] }, { name: 'ApproveResponse', fields: [{ name: 'success', type: 'Boolean!' }] } ] });
    await reqMeta('create_action', { name: 'triggerWorkflowRun', definition: { handler: '{{ACTION_BASE_URL}}/api/hasura/trigger', forward_client_headers: true, kind: 'synchronous', arguments: [{ name: 'workflow_id', type: 'uuid!' }], output_type: 'TriggerResponse' } });
    await reqMeta('create_action', { name: 'approveStep', definition: { handler: '{{ACTION_BASE_URL}}/api/hasura/approve', forward_client_headers: true, kind: 'synchronous', arguments: [{ name: 'step_run_id', type: 'uuid!' }, { name: 'approved', type: 'Boolean!' }], output_type: 'ApproveResponse' } });
    await reqMeta('create_action_permission', { action: 'triggerWorkflowRun', role: 'user' });
    await reqMeta('create_action_permission', { action: 'approveStep', role: 'user' });
    console.log("Actions created successfully!");
  } catch (e) {
    console.error("Failed to create actions");
    process.exit(1);
  }
}

deployActions().catch(console.error);
