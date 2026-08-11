const API_URL = 'https://ai-agent-workflow-builder-a9ot.vercel.app/api';
const GRAPHQL_URL = 'https://select-satyr-95.hasura.app/v1/graphql';

async function login(email) {
  const res = await fetch(`${API_URL}/auth/login`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email })
  });
  if (!res.ok) throw new Error('Login failed for ' + email);
  return (await res.json()).token;
}

async function reqGraphQL(token, query, variables, userId) {
  const headers = { 
    'Content-Type': 'application/json', 
    'X-Hasura-Admin-Secret': 'Wm6QDGSNlVgcNZVUhXVOPg4xMU3yEk18jcBcpZwgyEBdSRfWIehKmKAwezw2o9GN',
    'X-Hasura-Role': 'user',
    'X-Hasura-User-Id': userId
  };
  const res = await fetch(GRAPHQL_URL, {
    method: 'POST',
    headers,
    body: JSON.stringify({ query, variables })
  });
  const data = await res.json();
  if (!data.data && !data.errors) {
     console.log("Raw GraphQL Response:", data);
  }
  if (data.errors) {
    console.error("GraphQL Error:", JSON.stringify(data.errors, null, 2));
    throw new Error("GraphQL Error");
  }
  return data.data;
}

const sleep = ms => new Promise(r => setTimeout(r, ms));

async function runTest() {
  console.log("=== Production Smoke Test ===");
  try {
    // 1. Login
    const resA = await fetch(`${API_URL}/auth/login`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email: 'orga-owner@test.com' }) });
    const userA = (await resA.json()).user;
    const resB = await fetch(`${API_URL}/auth/login`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email: 'orgb-owner@test.com' }) });
    const userB = (await resB.json()).user;
    console.log("PASS: Logins successful");

    // 2. Org A queries its org ID
    let q = await reqGraphQL(null, `query { organizations { id } }`, {}, userA.id);
    const orgId = q.organizations[0].id;

    // 3. Create Workflow
    q = await reqGraphQL(null, `mutation($org_id: uuid!) { insert_workflows_one(object: { name: "Prod Smoke Test", org_id: $org_id }) { id } }`, { org_id: orgId }, userA.id);
    const wfId = q.insert_workflows_one.id;
    console.log("PASS: Created workflow", wfId);

    // 4. Add Steps
    const steps = [
      { workflow_id: wfId, position: 0, type: 'llm_call', config: { prompt: "Analyze this and output exactly APPROVE", model: "gemini-1.5-flash" } },
      { workflow_id: wfId, position: 1, type: 'conditional_branch', config: { match: "APPROVE|REJECT" } },
      { workflow_id: wfId, position: 2, type: 'http_request', config: { url: "https://jsonplaceholder.typicode.com/todos/1", method: "GET" } },
      { workflow_id: wfId, position: 3, type: 'approval_gate', config: {} }
    ];
    await reqGraphQL(null, `mutation($objects: [workflow_steps_insert_input!]!) { insert_workflow_steps(objects: $objects) { affected_rows } }`, { objects: steps }, userA.id);
    console.log("PASS: Added steps: llm_call, conditional_branch, http_request, approval_gate");

    // 5. Trigger Workflow Run
    q = await reqGraphQL(null, `mutation($wfId: uuid!) { triggerWorkflowRun(workflow_id: $wfId) { run_id status } }`, { wfId }, userA.id);
    const runId = q.triggerWorkflowRun.run_id;
    console.log("PASS: Triggered workflow run", runId);

    // 6. Poll for approval gate
    console.log("Polling for execution (waiting for approval_gate)...");
    let stepRunIdToApprove = null;
    let retries = 30;
    while (retries-- > 0) {
      q = await reqGraphQL(null, `query($runId: uuid!) { workflow_runs_by_pk(id: $runId) { status step_runs(order_by: { step: { position: asc } }) { id status step { type } output } } }`, { runId }, userA.id);
      const run = q.workflow_runs_by_pk;
      const approvalStep = run.step_runs.find(s => s.step.type === 'approval_gate');
      if (approvalStep && approvalStep.status === 'paused') {
        stepRunIdToApprove = approvalStep.id;
        console.log("PASS: Execution paused at approval_gate");
        
        // Verify previous steps output
        const llm = run.step_runs.find(s => s.step.type === 'llm_call');
        const cond = run.step_runs.find(s => s.step.type === 'conditional_branch');
        const http = run.step_runs.find(s => s.step.type === 'http_request');
        if (llm.status !== 'completed' || cond.status !== 'completed' || http.status !== 'completed') {
            throw new Error("Previous steps did not complete successfully before approval gate");
        }
        console.log("PASS: Verified llm_call, conditional_branch, and http_request executed correctly before gate");
        break;
      }
      if (run.status === 'failed') throw new Error("Workflow run failed");
      await sleep(2000);
    }
    if (!stepRunIdToApprove) throw new Error("Timed out waiting for approval gate");

    // 7. Approve & Resume
    q = await reqGraphQL(null, `mutation($id: uuid!) { approveStep(step_run_id: $id, approved: true) { success } }`, { id: stepRunIdToApprove }, userA.id);
    console.log("PASS: Executed Approve & Resume action");

    // 8. Poll for completion
    console.log("Polling for completion...");
    retries = 20;
    while (retries-- > 0) {
      q = await reqGraphQL(null, `query($runId: uuid!) { workflow_runs_by_pk(id: $runId) { status } }`, { runId }, userA.id);
      if (q.workflow_runs_by_pk.status === 'completed') {
        console.log("PASS: Workflow completed successfully after approval");
        break;
      }
      await sleep(1000);
    }

    // 9. Verify Org B Isolation
    q = await reqGraphQL(null, `query($wfId: uuid!) { workflows_by_pk(id: $wfId) { id } }`, { wfId }, userB.id);
    if (q.workflows_by_pk === null) {
      console.log("PASS: Org B cannot see Org A workflow");
    } else {
      throw new Error("Org B can see Org A workflow!");
    }

    console.log("\n=== ALL TESTS PASSED SUCCESSFULLY ===");

  } catch (e) {
    console.error("FAIL:", e.message);
    process.exit(1);
  }
}

runTest();
