import { cp } from 'node:fs/promises';

await cp('public', '.next/standalone/public', { recursive: true });
