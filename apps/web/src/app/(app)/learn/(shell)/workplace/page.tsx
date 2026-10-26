import type {Metadata} from 'next';
import {notFound} from 'next/navigation';
import {eq} from 'drizzle-orm';
import {getSessionUser} from '@/server/auth';
import {db} from '@/server/db/client';
import {profiles} from '@/server/db/schema';
import {professionalEnabled,readWorkspace} from '@/server/workplace/service';
import {recommendedDomain} from '@/lib/workplace';
import {WorkplaceBoard} from '@/components/workplace/workplace-board';
export const metadata:Metadata={title:'Workplace practice'};
export const dynamic='force-dynamic';
export default async function WorkplacePage(){
  if(!professionalEnabled())notFound();
  const user=await getSessionUser();
  const profile=await (await db()).query.profiles.findFirst({where:eq(profiles.userId,user.id)});
  return <WorkplaceBoard initial={await readWorkspace(user.id)} recommended={recommendedDomain(profile?.answers as Record<string,unknown>)} learnerName={user.name}/>;
}
