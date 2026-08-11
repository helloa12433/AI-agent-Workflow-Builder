'use client';

import { gql } from '@apollo/client';
import * as ApolloReact from '@apollo/client/react';
const useQuery: any = ApolloReact.useQuery || (ApolloReact as any).default?.useQuery;
const useSubscription: any = ApolloReact.useSubscription || (ApolloReact as any).default?.useSubscription;
const useMutation: any = ApolloReact.useMutation || (ApolloReact as any).default?.useMutation;
import { useState, use } from 'react';
import { Play, PauseCircle, CheckCircle2, XCircle, Loader2, AlertCircle } from 'lucide-react';

const GET_WORKFLOW = gql`
  query GetWorkflow($id: uuid!) {
    workflows_by_pk(id: $id) {
      id
      name
      description
      org {
        members {
          role
          user_id
        }
      }
      steps(order_by: { position: asc }) {
        id
        type
        position
        config
      }
      triggers {
        id
        type
        config
      }
    }
  }
`;

const RUNS_SUBSCRIPTION = gql`
  subscription SubscribeRuns($workflowId: uuid!) {
    workflow_runs(where: { workflow_id: { _eq: $workflowId } }, order_by: { created_at: desc }, limit: 1) {
      id
      status
      started_at
      completed_at
      error
      step_runs(order_by: { step: { position: asc } }) {
        id
        workflow_step_id
        status
        output
        error
      }
    }
  }
`;

const TRIGGER_WORKFLOW = gql`
  mutation TriggerWorkflow($workflowId: uuid!) {
    triggerWorkflowRun(workflow_id: $workflowId) {
      run_id
      status
    }
  }
`;

const APPROVE_STEP = gql`
  mutation ApproveStep($stepRunId: uuid!, $approved: Boolean!) {
    approveStep(step_run_id: $stepRunId, approved: $approved) {
      success
    }
  }
`;

export default function WorkflowDetails({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const [triggering, setTriggering] = useState(false);
  
  const { data: wfData, loading: wfLoading } = useQuery(GET_WORKFLOW, { variables: { id }, skip: typeof window === 'undefined' });
  const { data: runData } = useSubscription(RUNS_SUBSCRIPTION, { variables: { workflowId: id }, skip: typeof window === 'undefined' });
  
  const [triggerRun] = useMutation(TRIGGER_WORKFLOW);
  const [approveStep] = useMutation(APPROVE_STEP);

  if (wfLoading || typeof window === 'undefined') return <div className="p-8">Loading workflow...</div>;
  const workflow = wfData?.workflows_by_pk;
  
  if (!workflow) return <div className="p-8 text-red-500">Workflow not found or access denied.</div>;

  const currentUserId = JSON.parse(localStorage.getItem('user') || '{}').id;
  const member = workflow.org.members.find((m: any) => m.user_id === currentUserId);
  const canTrigger = member?.role === 'owner' || member?.role === 'editor';
  
  const latestRun = runData?.workflow_runs[0];

  const handleRun = async () => {
    try {
      setTriggering(true);
      await triggerRun({ variables: { workflowId: id } });
    } catch (err: any) {
      alert("Failed to trigger: " + err.message);
    } finally {
      setTriggering(false);
    }
  };

  const handleApprove = async (stepRunId: string, approved: boolean) => {
    try {
      await approveStep({ variables: { stepRunId, approved } });
    } catch (err: any) {
      alert("Failed to approve: " + err.message);
    }
  };

  return (
    <div className="flex flex-col gap-8">
      <div className="flex items-center justify-between bg-white dark:bg-zinc-800 p-6 rounded-2xl shadow-sm border dark:border-zinc-700">
        <div>
          <h2 className="text-2xl font-bold">{workflow.name}</h2>
          <p className="text-gray-500 mt-1">{workflow.description}</p>
        </div>
        {canTrigger && (
          <button 
            onClick={handleRun}
            disabled={triggering || latestRun?.status === 'running' || latestRun?.status === 'paused'}
            className="flex items-center gap-2 bg-blue-600 disabled:bg-blue-400 text-white px-6 py-3 rounded-xl font-semibold shadow-md hover:bg-blue-700 transition-colors"
          >
            {triggering ? <Loader2 className="w-5 h-5 animate-spin" /> : <Play className="w-5 h-5 fill-current" />}
            {latestRun?.status === 'running' ? 'Running...' : 'Run Workflow'}
          </button>
        )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* Steps List */}
        <div className="flex flex-col gap-4">
          <h3 className="text-xl font-bold flex items-center gap-2">Workflow Steps</h3>
          <div className="flex flex-col gap-4">
            {workflow.steps.map((step: any, index: number) => (
              <div key={step.id} className="bg-white dark:bg-zinc-800 p-5 rounded-xl border dark:border-zinc-700 flex items-start gap-4 shadow-sm relative">
                <div className="bg-gray-100 dark:bg-zinc-700 text-gray-500 font-mono text-sm w-8 h-8 flex items-center justify-center rounded-full shrink-0">
                  {index + 1}
                </div>
                <div className="w-full">
                  <h4 className="font-semibold text-lg">{step.type}</h4>
                  <pre className="text-xs text-gray-500 mt-2 bg-gray-50 dark:bg-zinc-900 p-2 rounded-md overflow-auto">
                    {JSON.stringify(step.config, null, 2)}
                  </pre>
                </div>
              </div>
            ))}
            {workflow.steps.length === 0 && <p className="text-gray-500">No steps defined.</p>}
          </div>
        </div>

        {/* Live Execution View */}
        <div className="flex flex-col gap-4">
          <h3 className="text-xl font-bold flex items-center justify-between">
            Live Execution
            {latestRun && (
              <span className={`text-sm px-3 py-1 rounded-full border ${
                latestRun.status === 'completed' ? 'bg-green-50 text-green-700 border-green-200' :
                latestRun.status === 'failed' ? 'bg-red-50 text-red-700 border-red-200' :
                latestRun.status === 'paused' ? 'bg-yellow-50 text-yellow-700 border-yellow-200 animate-pulse' :
                'bg-blue-50 text-blue-700 border-blue-200 animate-pulse'
              }`}>
                Run Status: {latestRun.status}
              </span>
            )}
          </h3>

          {!latestRun ? (
            <div className="bg-white dark:bg-zinc-800 border dark:border-zinc-700 rounded-xl p-12 text-center text-gray-500">
              No executions yet. Run the workflow to see live status.
            </div>
          ) : (
            <div className="flex flex-col gap-4 bg-white dark:bg-zinc-800 border dark:border-zinc-700 rounded-xl p-6">
              {workflow.steps.map((step: any, index: number) => {
                const stepRun = latestRun.step_runs.find((sr: any) => sr.workflow_step_id === step.id);
                
                return (
                  <div key={step.id} className="flex flex-col gap-2 relative">
                    {index !== 0 && (
                      <div className="w-0.5 h-6 bg-gray-200 dark:bg-zinc-700 ml-4"></div>
                    )}
                    <div className={`flex items-start gap-4 p-4 rounded-xl border ${
                      !stepRun ? 'border-gray-100 dark:border-zinc-800 text-gray-400' :
                      stepRun.status === 'completed' ? 'border-green-200 bg-green-50/50 dark:bg-green-900/10 dark:border-green-900' :
                      stepRun.status === 'failed' ? 'border-red-200 bg-red-50/50 dark:bg-red-900/10 dark:border-red-900' :
                      stepRun.status === 'paused' ? 'border-yellow-300 bg-yellow-50 dark:bg-yellow-900/20 dark:border-yellow-700 ring-2 ring-yellow-400/50' :
                      'border-blue-200 bg-blue-50/50 dark:bg-blue-900/10 dark:border-blue-900'
                    }`}>
                      <div className="mt-1 shrink-0">
                        {!stepRun || stepRun.status === 'pending' ? <div className="w-6 h-6 rounded-full border-2 border-gray-300"></div> :
                         stepRun.status === 'running' ? <Loader2 className="w-6 h-6 text-blue-500 animate-spin" /> :
                         stepRun.status === 'completed' ? <CheckCircle2 className="w-6 h-6 text-green-500" /> :
                         stepRun.status === 'failed' ? <XCircle className="w-6 h-6 text-red-500" /> :
                         <AlertCircle className="w-6 h-6 text-yellow-500" />
                        }
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex justify-between items-center">
                          <h5 className="font-semibold text-gray-900 dark:text-white">Step {index + 1}: {step.type}</h5>
                          {stepRun?.status && (
                            <span className="text-xs uppercase tracking-wider font-semibold text-gray-500">{stepRun.status}</span>
                          )}
                        </div>
                        
                        {stepRun?.error && (
                          <div className="mt-2 text-sm text-red-600 break-words bg-red-50 p-2 rounded">
                            {stepRun.error}
                          </div>
                        )}
                        
                        {stepRun?.status === 'paused' && step.type === 'approval_gate' && (
                          <div className="mt-4 flex flex-col gap-3 p-4 bg-white dark:bg-zinc-900 rounded-lg border border-yellow-200 shadow-sm">
                            <p className="text-sm font-medium text-gray-800 dark:text-gray-200">
                              This workflow is paused and requires approval to continue.
                            </p>
                            {canTrigger ? (
                              <div className="flex gap-3 mt-1">
                                <button 
                                  onClick={() => handleApprove(stepRun.id, true)}
                                  className="px-4 py-2 bg-green-600 hover:bg-green-700 text-white text-sm font-semibold rounded-md transition-colors"
                                >
                                  Approve & Resume
                                </button>
                                <button 
                                  onClick={() => handleApprove(stepRun.id, false)}
                                  className="px-4 py-2 bg-red-100 hover:bg-red-200 text-red-700 text-sm font-semibold rounded-md transition-colors"
                                >
                                  Reject
                                </button>
                              </div>
                            ) : (
                              <p className="text-xs text-red-500 italic">You do not have permission to approve this step.</p>
                            )}
                          </div>
                        )}
                        
                        {stepRun?.output && stepRun.status === 'completed' && (
                          <div className="mt-2 text-xs font-mono text-gray-600 dark:text-gray-400 bg-white dark:bg-zinc-900 p-3 rounded border dark:border-zinc-700 overflow-x-auto">
                            {JSON.stringify(stepRun.output, null, 2)}
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
