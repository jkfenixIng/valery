import { signOut } from '@/modules/auth/presentation';
import { GlassButton, GlassCard } from '@/shared/ui';

export default function AdminPage() {
  return (
    <main className="auth-page">
      <GlassCard className="auth-card">
        <h1>Panel de Valery</h1>
        <p>Sesión verificada con dos pasos.</p>
        <form action={signOut}>
          <GlassButton type="submit" variant="secondary">
            Cerrar sesión
          </GlassButton>
        </form>
      </GlassCard>
    </main>
  );
}
