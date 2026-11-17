import catalog from '@lms/fixtures/imported-courses.json';
import { isListedCourseId } from './catalog-visibility';

export type ImportedCourse = (typeof catalog)[number];
export type ImportedModule = ImportedCourse['modules'][number];
export const importedCourses: ImportedCourse[] = catalog;
export const listedImportedCourses = importedCourses.filter(c => isListedCourseId(c.id));
export const importedCourse = (id: string) => importedCourses.find(c => c.id === id);
export const importedModule = (courseId: string, moduleId: string) => importedCourse(courseId)?.modules.find(m => m.id === moduleId);

export type PackageState = { version: 1; cmi: Record<string, string>; storage: Record<string, string> };
export const emptyPackageState = (): PackageState => ({ version: 1, cmi: {}, storage: {} });
