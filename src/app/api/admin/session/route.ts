import { container } from '@/composition/container';

export async function GET(request: Request): Promise<Response> {
  const access = await container.auth.getAdminAccess(request.headers);

  if (access !== 'granted') {
    return Response.json({ error: 'No autorizado.' }, { status: 401 });
  }

  return Response.json({ status: 'ok' });
}
