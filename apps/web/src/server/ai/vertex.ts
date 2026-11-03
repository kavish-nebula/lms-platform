import 'server-only';
import { GoogleAuth } from 'google-auth-library';

export function vertexConfig(location = process.env.GOOGLE_CLOUD_LOCATION?.trim() || 'us-central1') {
  const project = process.env.GOOGLE_CLOUD_PROJECT?.trim();
  if (!project || !/^[a-z][a-z0-9-]{4,61}[a-z0-9]$/.test(project) || !/^[a-z0-9-]+$/.test(location)) throw new Error('Set a valid GOOGLE_CLOUD_PROJECT and GOOGLE_CLOUD_LOCATION.');
  const host = location === 'global' ? 'aiplatform.googleapis.com' : `${location}-aiplatform.googleapis.com`;
  return { project, location, root: `https://${host}/v1/projects/${project}/locations/${location}` };
}

let auth: GoogleAuth | undefined;
let authPath: string | undefined;
/** GoogleAuth caches and refreshes short-lived tokens; no static bearer token in .env. */
export async function vertexAccessToken() {
  const credentialPath = process.env.GOOGLE_APPLICATION_CREDENTIALS;
  if (!auth || authPath !== credentialPath) {
    authPath = credentialPath;
    auth = new GoogleAuth({ scopes: ['https://www.googleapis.com/auth/cloud-platform'], ...(credentialPath ? { keyFilename: credentialPath } : {}) });
  }
  try {
    const token = await auth.getAccessToken();
    if (!token) throw new Error();
    return token;
  } catch { throw new Error('Vertex authentication failed. Configure GOOGLE_APPLICATION_CREDENTIALS or Application Default Credentials.'); }
}
