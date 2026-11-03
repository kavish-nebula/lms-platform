/** Use the supported fallback for the recurring Windows Turbopack refresh loop. */
export function devBundlerArgs() {
  const name = process.env.LMS_DEV_BUNDLER ?? (process.platform === 'win32' ? 'webpack' : 'turbopack');
  if (!['webpack', 'turbopack'].includes(name)) throw new Error('LMS_DEV_BUNDLER must be webpack or turbopack.');
  return [`--${name}`];
}
