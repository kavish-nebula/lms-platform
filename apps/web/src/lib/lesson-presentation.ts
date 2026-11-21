export const NEUTRAL_VIDEO_VERSION = 'neutral-course-v1';
export function hasPlatformBrand(text: string) {
  return /nebula[\s_-]*know[\s_-]*lab/i.test(text);
}
/** Refresh internal media caches without changing lesson/revision resume keys. */
export function neutralCourseVideoUrl(source: string) {
  if (!source.startsWith('/api/v1/')) return source;
  const url = new URL(source, 'http://local.invalid');
  url.searchParams.set('presentation', NEUTRAL_VIDEO_VERSION);
  return url.pathname + url.search + url.hash;
}
