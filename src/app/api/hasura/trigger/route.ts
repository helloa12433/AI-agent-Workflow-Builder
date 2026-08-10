import { NextResponse } from 'next/server';
import { runGraphQL } from '@/lib/hasura';
import { executeRun } from '@/lib/executor';

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { workflow_id } = body.input;
    const sessionVars = body.session_variables;
    
    if (!sessionVars) {
      return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
    }

    const userId = sessionVars['x-hasura-user-id'];

    // 1. Verify caller is owner/editor of workflow's organization
    // 2. Check organization quota
    const verifyQuery = `
      query VerifyAccess($workflowId: uuid!, $userId: uuid!) {
        workflows_by_pk(id: $workflowId) {
          id
          org {
            id
            usage_calls
            usage_limit
            members(where: { user_id: { _eq: $userId } }) {
              role
            }
          }
        }
      }
    `;

    const verifyData: any = await runGraphQL(verifyQuery, { workflowId: workflow_id, userId });
    const workflow = verifyData.workflows_by_pk;

    if (!workflow || !workflow.org.members.length) {
      return NextResponse.json({ message: "Not found or unauthorized" }, { status: 403 });
    }

    const role = workflow.org.members[0].role;
    if (role !== 'owner' && role !== 'editor') {
      return NextResponse.json({ message: "Must be owner or editor to trigger" }, { status: 403 });
    }

    if (workflow.org.usage_calls >= workflow.org.usage_limit) {
      return NextResponse.json({ message: "Organization quota exhausted" }, { status: 400 });
    }

    // 3. Create workflow_run
    const insertRunQuery = `
      mutation CreateRun($workflowId: uuid!) {
        insert_workflow_runs_one(object: { workflow_id: $workflowId, status: "pending" }) {
          id
        }
      }
    `;

    const insertData: any = await runGraphQL(insertRunQuery, { workflowId: workflow_id });
    const runId = insertData.insert_workflow_runs_one.id;

    // 4. Start execution async (do not await)
    executeRun(runId).catch(console.error);

    return NextResponse.json({ run_id: runId, status: 'pending' });

  } catch (error: any) {
    console.error('Trigger error:', error);
    return NextResponse.json({ message: "Internal server error" }, { status: 500 });
  }
}
