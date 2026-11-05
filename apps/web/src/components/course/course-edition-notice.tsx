"use client";
import { useState } from 'react';
import useSWR from 'swr';
import { useRouter } from 'next/navigation';
import { api, storeEnrollment } from '@/lib/api';
import type { EnrollmentView } from '@/lib/learner-plan';
import { Button } from '@/components/ui/button';
export function CourseEditionNotice({courseId}:{courseId:string}){
 const url=`/api/v1/enrollments/${courseId}/upgrade`;const {data}=useSWR(url,(url:string)=>api<{available:boolean;editionId:string|null;title:string;moduleCount:number;history:{enrollmentId:string;title:string;completedTopics:number;projectReports:{passed:boolean;percent:number}[]}[]}>(url));const [accepted,setAccepted]=useState(false),[busy,setBusy]=useState(false),[error,setError]=useState('');const router=useRouter();
 if(!data?.available&&!data?.history?.length)return null;
 return <aside className="space-y-3 rounded-xl border border-brand-ink bg-panel p-5">{data!.available&&<><h2 className="font-semibold">A new course edition is available</h2><p>You are continuing your enrolled edition. The latest edition is {data!.title}, with {data!.moduleCount} modules.</p><label className="flex items-start gap-2"><input type="checkbox" checked={accepted} onChange={e=>setAccepted(e.target.checked)}/>Start a fresh enrollment in the expanded edition. Previous grades and submissions stay with my earlier edition; they do not complete the new course.</label><Button disabled={!accepted||busy} onClick={async()=>{setBusy(true);setError('');try{const r=await api<{enrollment:EnrollmentView}>(url,{method:'POST',body:{expectedEditionId:data!.editionId}});await storeEnrollment(r.enrollment);router.refresh();}catch(e){setError(e instanceof Error?e.message:'Upgrade failed. Your previous enrollment is retained.');}finally{setBusy(false);}}}>Upgrade to this edition</Button></>}{data!.history?.length>0&&<details><summary>Previous course editions</summary><ul className="mt-3 space-y-2">{data!.history.map(e=><li key={e.enrollmentId}>{e.title}: {e.completedTopics} completed topics. {e.projectReports.map((r,i)=><span key={i}>Project: {r.percent}% {r.passed?"passed":"not passed"}. </span>)}</li>)}</ul></details>}{error&&<p role="alert">{error}</p>}</aside>;
}
