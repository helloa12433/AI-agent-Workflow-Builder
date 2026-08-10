'use client';
import dynamic from 'next/dynamic';
const NewWorkflow = dynamic(() => import('./NewWorkflow'), { ssr: false });
export default function Page() { return <NewWorkflow />; }
