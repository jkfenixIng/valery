import { container } from '@/composition/container';

const handler = (request: Request): Promise<Response> =>
  container.auth.handleRequest(request);

export { handler as GET, handler as POST };
