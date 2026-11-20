import type { AuthoredCoursePackageData } from '@/lib/authored-course';

export function ProjectTaskList({ tasks }: { tasks?: AuthoredCoursePackageData['courseEnd']['miniProject']['tasks'] }) {
  if (!tasks?.length) return null;
  return <details className="space-y-3 rounded-xl border border-line bg-panel p-4"><summary className="cursor-pointer font-semibold">Tasks to accomplish · {tasks.length}</summary>
    <ol className="mt-4 space-y-4">{tasks.map((task, i) => <li key={task.id} className="space-y-2 rounded-lg border border-line p-4"><h3 className="font-semibold">{i + 1}. {task.title}</h3><p className="whitespace-pre-wrap text-sm">{task.instruction}</p><p className="text-sm"><strong>Expected evidence:</strong> {task.expectedEvidence}</p><p className="text-sm"><strong>Success criterion:</strong> {task.criterion}</p></li>)}</ol>
  </details>;
}
