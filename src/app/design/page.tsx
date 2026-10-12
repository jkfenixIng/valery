import {
  BottomNav,
  Field,
  GlassButton,
  GlassCard,
  Sheet,
  ThemeToggle,
} from '@/shared/ui';

const navigationItems = [
  { 'aria-current': 'page' as const, href: '/design', label: 'Sistema' },
  { href: '/', label: 'Inicio' },
  { href: '#componentes', label: 'Componentes' },
];

export default function DesignPage() {
  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-6xl flex-col gap-6 px-4 py-6 sm:px-6">
      <header className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="mb-1 text-sm font-bold tracking-[0.14em] text-[var(--primary)] uppercase">
            Valery · Fase 0
          </p>
          <h1 className="m-0 text-3xl font-black tracking-tight">
            Sistema de interfaz
          </h1>
          <p className="mb-0 max-w-xl text-[var(--muted)]">
            Fundaciones semánticas y componentes compartidos para flujos
            futuros.
          </p>
        </div>
        <ThemeToggle />
      </header>

      <section
        aria-labelledby="tokens-title"
        className="grid gap-4 md:grid-cols-2"
      >
        <GlassCard className="p-5">
          <h2 id="tokens-title" className="mt-0 text-xl">
            Tokens semánticos
          </h2>
          <p className="text-[var(--muted)]">
            Las superficies, acciones, bordes, foco y error se asignan por
            significado y no por color literal.
          </p>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            {[
              ['Superficie', 'var(--surface)'],
              ['Acción', 'var(--primary)'],
              ['Foco', 'var(--focus)'],
              ['Error', 'var(--danger)'],
            ].map(([label, color]) => (
              <div
                className="rounded-xl border border-[var(--border)] p-3"
                key={label}
              >
                <span
                  aria-hidden
                  className="mb-2 block h-8 rounded-lg border border-[var(--border)]"
                  style={{ background: color }}
                />
                <span className="text-sm font-bold">{label}</span>
              </div>
            ))}
          </div>
        </GlassCard>

        <GlassCard className="p-5">
          <h2 className="mt-0 text-xl">Estados de botón</h2>
          <div className="flex flex-wrap gap-3">
            <GlassButton>Normal</GlassButton>
            <GlassButton className="border-[var(--primary)] bg-[var(--primary-hover)]">
              Hover
            </GlassButton>
            <GlassButton className="outline outline-3 outline-offset-3 outline-[var(--focus)]">
              Focus
            </GlassButton>
            <GlassButton disabled>Deshabilitado</GlassButton>
            <GlassButton loading>Cargando</GlassButton>
          </div>
        </GlassCard>
      </section>

      <section
        aria-labelledby="componentes"
        className="grid gap-4 lg:grid-cols-2"
      >
        <GlassCard className="p-5">
          <h2 id="componentes" className="mt-0 text-xl">
            Campo
          </h2>
          <div className="grid gap-4">
            <Field label="Nombre del cliente" placeholder="Ej. Andrea Torres" />
            <Field
              error="Ingresa un correo válido para continuar."
              label="Correo"
              value="correo-invalido"
              readOnly
            />
            <Field
              disabled
              label="Referencia bloqueada"
              value="VR-00024"
              readOnly
            />
          </div>
        </GlassCard>

        <GlassCard className="flex flex-col justify-between gap-4 p-5">
          <div>
            <h2 className="mt-0 text-xl">Sheet</h2>
            <p className="text-[var(--muted)]">
              Una superficie contextual para acciones breves en pantallas
              táctiles.
            </p>
          </div>
          <Sheet open title="Acciones rápidas">
            <div className="flex flex-wrap gap-3">
              <GlassButton>Continuar</GlassButton>
              <GlassButton variant="secondary">Cancelar</GlassButton>
            </div>
          </Sheet>
        </GlassCard>
      </section>

      <footer className="mt-auto flex justify-center pt-2">
        <BottomNav items={navigationItems} />
      </footer>
    </main>
  );
}
