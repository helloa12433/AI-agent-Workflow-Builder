import { NextResponse } from 'next/server';
import { runGraphQL } from '@/lib/hasura';
import { executeRun } from '@/lib/executor';

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { step_run_id, approved } = body.input;
    const sessionVars = body.session_variables;
    
    if (!sessionVars) {
      return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
    }

    const userId = sessionVars['x-hasura-user-id'];

    const verifyQuery = `
      query VerifyAccess($stepRunId: uuid!, $userId: uuid!) {
        step_runs_by_pk(id: $stepRunId) {
          id
          status
          workflow_run_id
          run {
            workflow {
              org {
                members(where: { user_id: { _eq: $userId } }) {
                  role
                }
              }
            }
          }
        }
      }
    `;

    const verifyData: any = await runGraphQL(verifyQuery, { stepRunId: step_run_id, userId });
    const stepRun = verifyData.step_runs_by_pk;

    if (!stepRun || !stepRun.run.workflow.org.members.length) {
      return NextResponse.json({ message: "Not found or unauthorized" }, { status: 403 });
    }

    const role = stepRun.run.workflow.org.members[0].role;
    if (role !== 'owner' && role !== 'editor') {
      return NextResponse.json({ message: "Must be owner or editor to approve" }, { status: 403 });
    }

    if (stepRun.status !== 'paused') {
      return NextResponse.json({ message: "Step is not paused" }, { status: 400 });
    }

    // Update the step run
    const status = approved ? 'completed' : 'failed';
    const output = { approved, by: userId };
    
    await runGraphQL(`
      mutation CompleteApproval($id: uuid!, $status: String!, $output: jsonb!, $userId: uuid!) {
        update_step_runs_by_pk(pk_columns: { id: $id }, _set: { status: $status, output: $output, approved_by: $userId, approved_at: "now()" }) { id }
      }
    `, { id: step_run_id, status, output, userId });

    // If rejected, fail the run
    if (!approved) {
      await runGraphQL(`
        mutation FailRun($runId: uuid!) {
          update_workflow_runs_by_pk(pk_columns: { id: $runId }, _set: { status: "failed", error: "Approval rejected" }) { id }
        }
      `, { runId: stepRun.workflow_run_id });
      return NextResponse.json({ success: true });
    }

    // Resume execution
    await executeRun(stepRun.workflow_run_id).catch(console.error);

    return NextResponse.json({ success: true });

  } catch (error: any) {
    console.error('Approve error:', error);
    return NextResponse.json({ message: "Internal server error" }, { status: 500 });
  }
}
