# PRD: Plataforma de negocio de Valery

**Versión:** 1.1 (técnico, para agente de IA) **Idioma de la interfaz:** español (Colombia) **Moneda:** COP (pesos colombianos)

## 1. Resumen

Valery (15 años) vende postres, velas personalizadas, bolsas de regalo y otros productos hechos por ella. No le gusta hacer cuentas ni cotizaciones a mano. Este producto es una **web app instalable (PWA)** con dos caras sobre la misma base de datos:

- **Panel privado (admin):** calculadora de costos, cotizaciones, productos y recetas, inventario de insumos, clientes, pedidos y finanzas básicas.
- **Catálogo público:** vitrina con fotos y precios "desde", que lleva los pedidos a WhatsApp con el mensaje ya armado.

**Stack:** Next.js en Vercel con PostgreSQL en Neon, arquitectura limpia y ORM desacoplado (secciones 6 y 7).

**Restricción central:** costo de operación de 0 USD en planes gratuitos; el dominio propio es opcional (\~12 USD al año). Ver el riesgo del plan gratuito de Vercel en la sección 12.

## 2. Problema y objetivos

**Problema:** Valery calcula precios a ojo o a mano, lo que genera errores, trabajo regalado (su tiempo no se cobra) y desorden con insumos y pedidos. Los productos personalizables y los combos son donde más se pierde dinero.

**Objetivos**

1. Que cotizar un pedido tome menos de 2 minutos y sin hacer cuentas.
2. Que el precio siempre incluya materiales, su tiempo y su ganancia.
3. Que sepa qué insumos tiene y cuáles se están acabando.
4. Que los clientes vean el catálogo y pidan por WhatsApp con un clic.
5. Que ella aprenda de precios y ganancias de forma simple ("Mis números").

**Métricas de éxito (informales):** número de cotizaciones generadas por semana, porcentaje de productos con receta completa, pedidos recibidos desde el catálogo, uso semanal del panel por parte de Valery.

## 3. Usuarios

| Usuario | Descripción | Acceso |
| --- | --- | --- |
| **Valery (admin)** | Dueña del negocio, 15 años, usa el celular. Poca paciencia para números. | Login con correo y contraseña |
| **Adulto responsable (owner de cuentas)** | Madre o padre. Titular de las cuentas de hosting, base de datos y dominio. Supervisa. | Misma cuenta admin o acceso a configuración |
| **Cliente** | Persona que visita el catálogo por link (Instagram/WhatsApp). | Público, sin cuenta |

## 4. Alcance

**Dentro:** todo lo descrito en las Fases 0 a 4.

**Fuera (por ahora):** pagos en línea, facturación electrónica DIAN (los documentos de la app no tienen validez fiscal), envíos con transportadoras, cuentas de cliente, app nativa en tiendas, múltiples administradores, multimoneda, tienda con carrito y checkout.

## 5. Principios de diseño

1. **Mobile first.** Todo se usa cómodamente con una mano en el celular.
2. **Cero cuentas manuales.** Ella marca opciones; la app calcula.
3. **Flexible, no rígido.** Productos con categorías y tipos de cálculo; puede agregar cosas nuevas sin que cambie el código.
4. **Liviano.** Cada pantalla hace una cosa. Ningún formulario largo sin valores por defecto.
5. **Lo privado es privado de verdad.** Costos, márgenes e inventario nunca llegan al navegador de un cliente.
6. **Tono amigable.** Textos cortos, cálidos, sin jerga financiera (decir "tu ganancia", no "margen bruto").

## 6. Stack técnico y arquitectura

Decisión: monolito modular en Next.js (App Router) con arquitectura limpia, desplegado en Vercel sobre PostgreSQL en Neon. La base de datos y el ORM quedan detrás de interfaces para poder migrarlos sin tocar la lógica de negocio. Vercel y Neon son el punto de partida, no una dependencia: el sistema debe poder correr en otro hosting o en un VPS con Docker sin cambios de código (sección 6.4).

| Capa | Elección | Notas obligatorias |
| --- | --- | --- |
| Framework | Next.js (App Router) + TypeScript estricto | Server Components por defecto; Server Actions y Route Handlers solo como capa de entrada, sin lógica de negocio |
| Gestor de paquetes | pnpm | Lockfile versionado y versiones fijadas |
| Hosting | Vercel | Despliegue desde Git y previews por PR; reemplazable por Docker en un VPS (ver 6.4); riesgo del plan gratuito en la sección 12 |
| Base de datos | Neon (PostgreSQL serverless) | Conexión pooled para runtime y directa para migraciones; una rama de BD por entorno (dev, preview, prod); solo Postgres estándar, sin extensiones propias de Neon |
| ORM | Drizzle ORM + drizzle-kit | Esquema en TS y migraciones SQL versionadas; se usa únicamente en `infrastructure`. Drizzle ya soporta SQL Server en su rama 1.0 beta; si no es estable al empezar, usar Prisma (soporte oficial de SQL Server) con las mismas reglas. La elección se registra en un ADR (ver 6.5) |
| Autenticación | Better Auth (alternativa: Auth.js), correo y contraseña | Registro público deshabilitado; un único admin sembrado por script |
| UI | Tailwind CSS + shadcn/ui (Radix) | Los componentes viven en el repo y se envuelven en un kit propio (ver 6.3) |
| Temas | next-themes | Claro, oscuro y sistema, sin parpadeo al cargar |
| Validación | Zod | En cada frontera: formularios, acciones, endpoints y variables de entorno |
| Formularios | React Hook Form + resolver de Zod | Esquemas compartidos entre cliente y servidor |
| Estado de cliente | TanStack Query solo donde haya interacción intensiva (calculadora) | El resto se resuelve con Server Components y revalidación |
| Imágenes | Almacenamiento compatible con S3 detrás de un puerto (inicio: Vercel Blob o Cloudflare R2) | Compresión a WebP antes de subir; carga desde servidor |
| PWA | Serwist (`@serwist/next`) | Manifest, íconos y caché de lectura |
| Pruebas | Vitest (unitarias y de casos de uso), Playwright (e2e) | Repositorios en memoria para probar casos de uso sin BD |
| Calidad | ESLint, Prettier, Husky, lint-staged, dependency-cruiser, GitHub Actions | dependency-cruiser hace cumplir las reglas de capas en CI |
| Observabilidad | Logs estructurados en JSON por stdout (pino) + analítica opcional detrás de un puerto | Sentry opcional; nunca registrar datos personales |

### 6.1 Arquitectura limpia

Regla de dependencia: las dependencias apuntan siempre hacia adentro. `presentation` usa `application`, `application` usa `domain`, e `infrastructure` implementa los puertos (interfaces) que definen `application` y `domain`. Cambiar de Neon a otra base de datos, o de Drizzle a otro ORM, solo debe tocar `infrastructure` y la composición.

| Capa | Contiene | Puede importar | No puede importar |
| --- | --- | --- | --- |
| `domain` | Entidades, value objects (`Money`, `Quantity`, `Percentage`), reglas y el motor de precios como funciones puras | Solo TypeScript | Next, React, Drizzle, Neon, Zod, `application`, `infrastructure` |
| `application` | Casos de uso (`CalculateQuotePrice`, `CreateQuote`, `ConvertQuoteToOrder`, `ConsumeStockForOrder`), DTOs y puertos (`QuoteRepository`, `UnitOfWork`, `FileStorage`, `Clock`, `IdGenerator`) | `domain` | Next, React, Drizzle, `infrastructure` |
| `infrastructure` | Adaptadores: repositorios Drizzle, cliente Neon, Blob, autenticación, mapeadores fila a entidad | `application`, `domain`, librerías externas | `presentation` |
| `presentation` | Páginas, layouts, Server Actions, Route Handlers y componentes | `application` (vía contenedor), kit de UI | `infrastructure` directamente, `drizzle-orm` |

Reglas complementarias:

- Un contenedor de composición (`src/composition/container.ts`) crea los casos de uso con sus adaptadores; es el único lugar que conoce ambos lados.
- Las transacciones se expresan con el puerto `UnitOfWork`; el consumo de inventario y el cambio de estado de un pedido ocurren en una sola transacción.
- Las tablas de Drizzle no son las entidades de dominio: los repositorios mapean en ambos sentidos.
- Los errores de negocio son tipos explícitos (`Result` o errores de dominio), no excepciones genéricas.
- El dinero es un value object `Money` en pesos COP enteros; nunca `number` con decimales.

### 6.2 Estructura del repositorio

```text
src/
  app/                        # Next.js App Router (presentation)
    (public)/                 # catálogo y detalle de producto
    (admin)/admin/            # panel privado protegido
    api/                      # Route Handlers (uploads, health)
  modules/                    # un módulo por contexto de negocio
    catalog/                  # productos, categorías, opciones
      domain/
      application/
      infrastructure/
      presentation/
    supplies/                 # insumos e inventario
    pricing/                  # motor de cálculo
    quotes/
    orders/
    clients/
    finance/
    settings/
  shared/
    domain/                   # Money, Result, errores base
    infrastructure/db/        # cliente Neon, schema Drizzle, migraciones
    ui/                       # kit de diseño (primitivos, glass, layout)
    lib/                      # utilidades puras
  composition/                # contenedor de dependencias
  config/                     # variables de entorno validadas con Zod
tests/e2e/                    # Playwright
drizzle/                      # migraciones SQL versionadas
docs/adr/                     # decisiones de arquitectura
```

### 6.3 Sistema de diseño (UI)

Estilo juvenil y actual, con superficies de vidrio (glassmorphism), modo claro y oscuro, pensado primero para celular.

- **Tokens:** colores, radios, sombras, blur y espaciados como variables CSS en `:root` y `.dark`, enlazadas a Tailwind. Ningún componente usa colores fijos (hex) directamente. La paleta provisional (rosa, lila, menta) se reemplaza con la marca en la Fase 4.
- **Superficie glass:** fondo translúcido, `backdrop-filter: blur`, borde de 1 px semitransparente, sombra suave y radios de 16 a 24 px sobre fondos con degradados suaves.
- **Accesibilidad sobre vidrio:** contraste mínimo WCAG AA (4,5:1) verificado en ambos temas; sin glass en tablas densas ni en texto largo; fallback a fondo sólido si no hay soporte de `backdrop-filter` o el usuario pide menos transparencia.
- **Capas de componentes:** (1) primitivos de shadcn/Radix, usados solo dentro de `shared/ui`; (2) kit propio reutilizable (`GlassCard`, `GlassButton`, `Field`, `MoneyInput`, `QuantityStepper`, `StatusBadge`, `EmptyState`, `Sheet`, `BottomNav`); (3) compuestos por módulo (`QuoteSummary`, `ProductCard`, `StockAlertList`). Los módulos solo consumen la capa 2.
- **Navegación:** barra inferior en celular y barra lateral en escritorio dentro del admin.
- **Tipografía:** `next/font` con una fuente de texto sobria y una de títulos con personalidad; escala tipográfica definida en tokens.
- **Localización:** textos en español colombiano centralizados en un diccionario; montos con `Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP' })`.
- **Documentación visual:** ruta interna `/design` (o Storybook) con todos los componentes en claro y oscuro.

**Paleta inicial (provisional hasta la Fase 4).** Ambiente cálido y dulce, acorde a postres, velas y regalos: frambuesa como color principal, lila como secundario y menta como acento. Los valores son punto de partida; el agente debe verificar contraste AA (4,5:1) en ambos temas y ajustarlos si alguno no cumple.

| Token | Tema claro | Tema oscuro | Uso |
| --- | --- | --- | --- |
| `--background` | `#FFF7FA` | `#14101A` | Fondo de la app |
| `--blob-pink` / `--blob-lilac` / `--blob-mint` | `#FFC2D9` / `#D9C8FF` / `#BFF0E0` | `#5B2A4A` / `#3A2A6B` / `#1F4D45` | Manchas de degradado detrás del vidrio |
| `--glass` | `rgba(255,255,255,0.55)` | `rgba(255,255,255,0.08)` | Superficie de tarjetas y paneles |
| `--glass-border` | `rgba(255,255,255,0.70)` | `rgba(255,255,255,0.14)` | Borde de 1 px del vidrio |
| `--foreground` | `#2B1B2E` | `#F6EEF8` | Texto principal |
| `--muted-foreground` | `#6B5870` | `#B9A9C0` | Texto secundario |
| `--primary` | `#C92A63` | `#FF7AA8` | Botones principales y enlaces (texto sobre él: `#FFFFFF` en claro, `#2B0F1C` en oscuro) |
| `--secondary` | `#6D4AE0` | `#B79CFF` | Acciones secundarias y selección |
| `--accent` | `#0F8F6F` | `#5FE3BE` | Éxito, ganancia positiva, "listo" |
| `--warning` | `#B45309` | `#FFB86B` | Alertas de poco inventario |
| `--danger` | `#D92D20` | `#FF8A80` | Errores, pérdida, cancelado |

Reglas de uso:

- Los valores viven solo en un archivo de tokens (`shared/ui/theme/tokens.css`) y se exponen a Tailwind como variables; cambiar la marca en la Fase 4 es editar ese archivo.
- Colores por categoría del catálogo: Postres en frambuesa, Velas en lila, Regalos en menta, Otros en durazno (`#F59E5B`).
- Estados de pedido: pendiente en durazno, en proceso en lila, listo en menta, entregado en gris neutro, cancelado en rojo.
- La ganancia positiva usa `--accent` y la baja o negativa usa `--warning` o `--danger`, siempre acompañada de un ícono o texto, nunca solo por color.
- Probar ambos temas con simulación de daltonismo y con `prefers-contrast` y `prefers-reduced-transparency` activados.

### 6.4 Portabilidad: Vercel y Neon son reemplazables

Objetivo: si el negocio crece, pasar a otro hosting o a un VPS debe ser un cambio de configuración y, como máximo, de un adaptador, sin reescribir módulos ni transformar datos. Cada servicio externo se trata como una pieza intercambiable.

| Dependencia | Cómo se aísla | Salida posible |
| --- | --- | --- |
| Hosting (Vercel) | App autocontenida: `output: 'standalone'` en Next.js, `Dockerfile` multi-etapa y `docker-compose.yml` mantenidos desde la Fase 0 y probados en CI. Configuración solo por variables de entorno. Sin paquetes `@vercel/*` ni APIs exclusivas de Vercel, y sin runtime Edge (usar Node.js). | VPS con Docker y un proxy con HTTPS automático (Caddy o Nginx), Coolify, Railway, Render, Fly.io |
| Base de datos (Neon) | Postgres estándar; conexión solo por `DATABASE_URL`; driver estándar (`postgres` o `pg`) con pooling configurable; sin extensiones ni funciones propias de Neon (sus ramas son solo una herramienta de desarrollo). | Cualquier Postgres: contenedor propio en el VPS, Supabase, RDS. Migración con `pg_dump` y `pg_restore` |
| ORM | Usado solo dentro de `infrastructure`, detrás de repositorios. | Otro ORM o SQL directo, reescribiendo solo los adaptadores |
| Imágenes | Puerto `FileStorage` con adaptador compatible con S3; en la BD se guardan claves relativas, nunca URLs absolutas del proveedor. | Cloudflare R2, S3, MinIO o disco local en el VPS |
| Autenticación | Sesiones y usuarios en nuestro propio Postgres; sin servicio externo de identidad. | Mismas tablas en cualquier Postgres |
| Caché | Caché y revalidación nativas de Next.js, que funcionan autoalojadas; instalar `sharp` para imágenes. Caché compartida con Redis solo si algún día hace falta. | Redis en el VPS |
| Tareas programadas | Casos de uso expuestos en un endpoint protegido con secreto; quién lo dispara es intercambiable. | Cron del sistema, GitHub Actions |
| Límite de peticiones | Puerto `RateLimiter` con adaptador sobre Postgres por defecto, sin Redis obligatorio. | Redis |
| Correo, analítica, errores | Un puerto por servicio; el proveedor se elige con una variable. | Cualquier SMTP o proveedor |
| CI/CD | GitHub Actions construye la imagen Docker; el paso de despliegue es reemplazable. | SSH al VPS, Coolify, registro de contenedores |

Reglas de portabilidad obligatorias:

- Toda variable de entorno se lee y valida únicamente en `config/`; prohibido usar `process.env` en otros lugares.
- Los paquetes `@vercel/*` y `@neondatabase/*` solo pueden aparecer en archivos de adaptador dentro de `infrastructure`, y dependency-cruiser lo verifica.
- Cada servicio externo tiene puerto, adaptador y una variable que lo selecciona (por ejemplo `STORAGE_DRIVER=s3` o `local`).
- El esquema y las migraciones nunca dependen de funciones propias de Neon.
- Prueba de portabilidad en CI: levantar `docker-compose` (app y Postgres local), aplicar migraciones y correr las pruebas e2e de humo. Si falla, la fase no se da por terminada.
- Un runbook en `docs/` explica paso a paso cómo mudar a un VPS (volcado de la BD, restauración, variables, DNS y tiempo estimado de corte) y se prueba una vez antes del lanzamiento público.
- Los datos de Valery siempre se pueden sacar completos: exportación CSV o JSON desde el panel y volcado de Postgres.

### 6.5 Acceso a datos: sin SQL escrito a mano y portable entre motores

Regla: el código nunca contiene sentencias SQL en texto. Todo acceso a datos usa el constructor de consultas y las expresiones tipadas del ORM, de modo que pasar de PostgreSQL a SQL Server (u otro motor) solo toque `infrastructure`.

**Estado del ORM frente a SQL Server.** Drizzle incorporó soporte de MSSQL en su versión 1.0 beta ([Drizzle y MSSQL](https://drizzle.zhcndoc.com/docs/get-started-mssql)); Prisma lo soporta oficialmente y Microsoft lista los ORMs compatibles ([ORMs con SQL Server](https://learn.microsoft.com/it-it/sql/tools/visual-studio-code-extensions/github-copilot/orm-integrations?view=sql-server-ver17)). Antes de fijar versiones, el agente verifica el soporte vigente del motor destino y deja la decisión en un ADR.

**Reglas obligatorias**

- Prohibido SQL como texto: sin plantillas con `${}`, sin concatenación, sin `sql` crudo y sin `db.execute('...')` dentro de los módulos. El CI falla si aparecen fuera de `shared/infrastructure/db/raw/`, carpeta que solo admite excepciones documentadas en un ADR y revisadas en el PR.
- Las consultas se arman con el constructor tipado del ORM (comparaciones, `and`, `or`, `inArray`, `orderBy`, `limit`, `join`, agregados) o con su API relacional.
- Los filtros reutilizables son funciones que devuelven condiciones (por ejemplo `publishedProducts()` o `lowStockSupplies()`): se componen, se prueban y evitan repetir criterios.
- Las consultas viven solo en los repositorios; los casos de uso piden por intención (`findLowStockSupplies()`) y nunca construyen filtros.
- Si el ORM no ofrece una función, se resuelve en TypeScript antes de recurrir a SQL; el volumen del negocio lo permite.
- Esquema portable: sin `jsonb`, arreglos, enums nativos, tipos geográficos, extensiones, columnas generadas, triggers, procedimientos almacenados ni índices parciales. Los snapshots son JSON serializado en una columna de texto que mapea el repositorio; los estados son texto con restricción `CHECK` o tabla de catálogo; los UUID los genera la aplicación.
- Búsquedas sin `ILIKE` ni dependencia de la colación del motor: usar una columna normalizada en minúsculas y sin acentos (`name_search`), y normalizar el `slug` en la aplicación.
- Upserts, `RETURNING` y otras sintaxis específicas solo mediante la API del ORM; si el comportamiento cambia por motor, se encapsula en el repositorio.
- La lógica de negocio vive en el dominio; la base de datos guarda datos y restricciones simples (clave primaria, foránea, única y `CHECK` sencillos).
- Las transacciones pasan por el puerto `UnitOfWork`; la paginación usa las funciones del ORM.
- Migraciones: las genera la herramienta del ORM por dialecto. Al cambiar de motor se crea una nueva línea base y los datos se trasladan con los casos de uso `ExportAllData` e `ImportAllData` (JSON versionado), no con `pg_dump`, que solo sirve entre instancias de PostgreSQL.
- Pruebas de contrato de repositorios: la misma batería corre contra cualquier adaptador, hoy contra Postgres en CI y, al migrar, contra el nuevo motor en un contenedor.

**Criterios de aceptación**

- El CI falla si hay SQL crudo fuera de la carpeta de excepciones o si el esquema importa tipos exclusivos de PostgreSQL (`jsonb`, `pgEnum`, arreglos).
- La batería de contrato de repositorios pasa completa contra Postgres.
- `ExportAllData` e `ImportAllData` restauran una base vacía con los mismos datos, verificado en CI.

### 6.6 Desarrollo con TDD y pruebas solo de lo crítico

El desarrollo es por TDD, pero únicamente sobre lo crítico: lo que, si falla, cuesta dinero, expone datos o rompe un flujo clave. No se escriben pruebas para subir un porcentaje de cobertura ni por completar. Menos pruebas, bien elegidas, se escriben y se corren más rápido y se mantienen mejor.

**Ciclo por tarea crítica:** (1) escribir la prueba del comportamiento y verla fallar; (2) implementar lo mínimo para que pase; (3) refactorizar con la prueba en verde; (4) hacer commit de prueba y código juntos. Lo que no es crítico se implementa directamente, sin prueba.

**Sí lleva prueba (lista crítica)**

- Motor de precios y todo cálculo de dinero: costo, mano de obra, indirectos, margen, redondeo, escalado de recetas y combos que incluyen otros productos.
- Inventario: descuento al pasar un pedido a "en proceso", sin duplicarse, y reversión al cancelar.
- Seguridad y privacidad: el DTO público y el DTO de cliente (también el texto del PDF) sin campos internos, acceso anónimo bloqueado en el admin, límite de intentos de login y enlaces vencidos o revocados.
- Documentos: numeración consecutiva sin duplicados y snapshot inmutable al emitir.
- Autorización en los casos de uso de administración.
- Contrato de repositorios (una batería reutilizable) y exportar e importar todos los datos.
- Pocos flujos e2e: cotizar, convertir en pedido y consumir stock; publicar un producto y verlo en el catálogo; headers de seguridad en producción.
- Todo error encontrado en producción: primero se escribe la prueba que lo reproduce.

**No lleva prueba**

- Estilos, diseño, textos, tokens y componentes puramente visuales, ni capturas completas de la interfaz.
- Código que solo delega en librerías (shadcn, next-themes) o en el ORM sin lógica propia.
- Mapeos triviales, getters y configuración.
- Comportamiento que ya cubre otra prueba en otra capa.

**Reglas para escribir las pruebas**

- Una prueba por comportamiento, no por campo ni por línea. Si varias validaciones pertenecen a la misma funcionalidad, se agrupan en una sola prueba parametrizada con una tabla de casos (por ejemplo, todas las entradas inválidas de un insumo), con una etiqueta por caso para saber cuál falló.
- Nombres en lenguaje de negocio, por ejemplo "cotiza una vela con extras y muestra la ganancia".
- Se prueba el comportamiento, no la implementación: repositorios en memoria en lugar de mocks por todas partes.
- Prohibidas las pruebas que solo comprueban que algo existe o se renderiza, y las que existen únicamente para subir la cobertura.
- La cobertura es un indicador, no una meta: no hay umbral global. En el motor de precios y en inventario se revisan las ramas de negocio relevantes.
- Rapidez: las pruebas unitarias y de casos de uso corren en menos de 30 segundos en total y los e2e en menos de 5 minutos.

**Criterios de aceptación**

- Cada prueba corresponde a un elemento de la lista crítica; en cada pull request se responde qué comportamiento crítico cubre y se rechazan las de relleno.
- No existen dos pruebas que validen campos de la misma funcionalidad por separado.
- El CI ejecuta la suite completa dentro de los tiempos indicados.

## 7. Seguridad y privacidad

Principio: toda lectura y escritura pasa por el servidor; el navegador nunca habla con la base de datos. Estos controles son obligatorios, no recomendaciones.

| Área | Requisito |
| --- | --- |
| Acceso a datos | Neon solo es accesible desde el servidor (Vercel). `DATABASE_URL` nunca lleva el prefijo `NEXT_PUBLIC_`. La app usa un rol de BD con privilegios mínimos (sin DDL); las migraciones usan otro rol. Conexión con `sslmode=require`. |
| Autorización | Defensa en profundidad: middleware, guard en cada Server Action y Route Handler, y verificación de sesión admin dentro del caso de uso. Nunca depender solo del middleware. |
| Superficie pública | El catálogo se lee solo mediante casos de uso públicos que devuelven DTOs explícitos con lista de campos permitidos (`PublicProductDTO`). Prohibido devolver entidades completas; costos, márgenes, recetas, inventario y clientes nunca salen en una respuesta pública. |
| Autenticación | Contraseñas con hash moderno (argon2id o equivalente de la librería), cookies `httpOnly`, `Secure`, `SameSite=Lax`, sesiones con expiración y rotación, registro público deshabilitado, límite de intentos de login con bloqueo temporal, recuperación de contraseña gestionada por el adulto responsable. 2FA TOTP obligatorio en la cuenta admin, con códigos de recuperación impresos y guardados por el adulto. |
| Validación | Zod en cada Server Action, Route Handler y variable de entorno (la app no arranca si faltan). El precio siempre se recalcula en el servidor con el motor de dominio; nunca se confía en un total enviado por el cliente. |
| Protecciones web | Verificación de origen en acciones y endpoints que modifican datos, CSP con nonces, HSTS, `X-Content-Type-Options`, `Referrer-Policy`, `Permissions-Policy`, `frame-ancestors 'none'`. Sin `dangerouslySetInnerHTML`. |
| Subidas de archivos | Solo admin; tipos JPEG, PNG y WebP; tamaño máximo 5 MB; validar firma real del archivo; nombres generados por el servidor. |
| Secretos | Variables por entorno en Vercel; `.env.local` en `.gitignore`; escaneo de secretos (gitleaks) en CI; rotación documentada en el README. |
| Dependencias | Renovate o Dependabot, `pnpm audit` en CI, lockfile y versiones fijadas. |
| Datos personales | De clientes solo nombre, teléfono y dirección opcional. Aviso de tratamiento de datos (Ley 1581 de 2012) donde haya formulario; sin datos personales en logs; borrado o anonimización a solicitud. Sin pagos ni datos bancarios en la app. |
| Abuso | Límite de peticiones en endpoints públicos y honeypot en formularios; los enlaces de WhatsApp se arman solo con datos del producto, sin datos personales. |
| Respaldos | Restauración a un punto en el tiempo de Neon (ventana limitada en el plan gratuito), exportación CSV desde el panel y script `pg_dump` documentado. |
| Cuentas | Un adulto es titular de Vercel, Neon, GitHub y dominio, con verificación en dos pasos activada; Valery es usuaria sin acceso a facturación ni a configuración de infraestructura. |

### 7.1 Amenazas y defensas adicionales (todas gratuitas y dentro del proyecto)

Ningún sistema es invulnerable. El objetivo es dificultar el ataque, limitar el daño si algo falla y poder recuperarse. Activos a proteger: la cuenta admin, los datos de clientes, los costos y márgenes, y los enlaces de documentos. Referencia: OWASP Top 10 y OWASP ASVS nivel 1; cada pull request de fase revisa esta lista.

| Amenaza | Defensa |
| --- | --- |
| Robo de la cuenta admin por fuerza bruta | Contraseña de al menos 12 caracteres con medidor de fortaleza (zxcvbn), 2FA obligatorio, límite de intentos por IP y por usuario con bloqueo progresivo, mensajes de error idénticos para no revelar si un usuario existe, y cierre de todas las sesiones al cambiar la contraseña |
| Robo de sesión | Cookies `httpOnly`, `Secure` y `SameSite`, sesiones con expiración, botón "cerrar sesión en todos los dispositivos" y recomendación de bloqueo de pantalla en el celular donde esté instalada la app |
| Inyección SQL | Solo consultas parametrizadas del ORM; prohibido construir SQL concatenando texto, con regla de lint y revisión en cada PR |
| XSS (código malicioso en la página) | React escapa por defecto, sin `dangerouslySetInnerHTML`, CSP con nonces y los documentos PDF se generan sin HTML del usuario |
| Peticiones falsas (CSRF) | Verificación de origen, `SameSite` y token en los Route Handlers que modifican datos |
| Bots y spam en formularios públicos | Honeypot, límite por IP y Cloudflare Turnstile (gratuito) si hay formulario de pedido |
| Ataques de saturación (DoS) | Catálogo en caché, límites de peticiones, tope de tamaño de cuerpo y de tiempo por petición, paginación con máximos y, opcionalmente, el proxy gratuito de Cloudflare delante del dominio (funciona igual en Vercel o en un VPS) |
| Acceso a datos ajenos (IDOR, enumeración) | UUID no secuenciales, enlaces con token aleatorio, verificación de permisos en cada caso de uso y respuesta 404 uniforme |
| Fuga de datos por el código | DTOs públicos con lista de campos permitidos, pruebas de contrato y nunca serializar entidades completas |
| Fuga por errores y logs | Sin datos personales en logs, mensajes de error genéricos al usuario, detalle solo en logs, `poweredByHeader` desactivado |
| Secretos filtrados | gitleaks en pre-commit y en CI, secret scanning y push protection de GitHub, variables por entorno y rotación documentada |
| Paquetes maliciosos (cadena de suministro) | Lockfile con `pnpm install --frozen-lockfile`, versiones fijadas, scripts de instalación deshabilitados salvo lista permitida, `pnpm audit` en CI y actualizaciones con revisión humana, esperando unos días antes de adoptar versiones recién publicadas |
| Vulnerabilidades en el código | Reglas de seguridad de ESLint, CodeQL (gratuito en repositorios públicos) o Semgrep Community, y escaneo base de OWASP ZAP contra el preview en CI |
| Pérdida o secuestro de datos | Respaldo diario con `pg_dump` cifrado (age o gpg) y una copia fuera del proveedor de la base de datos, prueba de restauración cada trimestre y borrado lógico |
| Compromiso del servidor (si se muda a un VPS) | Contenedor sin usuario root, imagen mínima, firewall con solo los puertos 80, 443 y SSH, SSH solo con llaves, actualizaciones automáticas, fail2ban y Postgres sin puerto público |
| Detección y auditoría | Tabla `audit_logs` con inicios de sesión, cambios de precios, exportaciones, emisión y revocación de documentos y cambios de contraseña, más una pantalla "Actividad reciente" que puede revisar el adulto |

Otros requisitos:

- `SECURITY.md` y `/.well-known/security.txt` con un contacto para reportar fallos.
- Un test e2e que verifica los headers de seguridad y la CSP en producción.
- Un plan de respuesta a incidentes en `docs/security.md`: qué hacer si se sospecha un acceso indebido (rotar secretos, cerrar sesiones, revocar enlaces, restaurar el respaldo y avisar a los clientes afectados); si se filtraran datos personales, consultar la obligación de reportar ante la Superintendencia de Industria y Comercio.
- Los respaldos y la restauración se prueban antes del lanzamiento público.

**Criterios de aceptación de seguridad (Fase 0 en adelante)**

- El CI falla si gitleaks encuentra un secreto, si `pnpm audit` reporta una vulnerabilidad alta o crítica, o si la prueba de headers falla.
- Un usuario anónimo recibe 401 o redirección en toda ruta y acción de admin, verificado con pruebas e2e.
- El login queda bloqueado temporalmente tras varios intentos fallidos y no revela si el usuario existe.
- Existe un respaldo cifrado reciente y una restauración probada con éxito.
- `audit_logs` registra los eventos listados y no contiene datos personales ni contraseñas.

## 8. Modelo de datos (conceptual)

Convenciones (Postgres estándar, sin extensiones propietarias de Neon, para poder migrar):

- IDs UUID v7 generados en la aplicación mediante el puerto `IdGenerator`.
- `created_at` y `updated_at` en `fecha-hora del ORM` (UTC); `deleted_at` para borrado lógico en productos, insumos y clientes.
- Dinero: entero en pesos COP (`bigint`), nunca decimales flotantes. Cantidades: `numeric(14,3)`. Porcentajes: puntos básicos enteros.
- `quote_items` y `order_items` guardan costo y precio congelados y un `pricing_snapshot text` (receta, opciones y tarifa usadas).
- El stock sale de `stock_movements` (fuente de verdad), con `quantity_on_hand` actualizada en la misma transacción.
- Índices en claves foráneas, `orders(status, delivery_date)`, `products(is_published, category_id)` y `products(slug)` único.
- Restricciones `CHECK` en cantidades, márgenes y estados válidos.
- Migraciones versionadas con drizzle-kit; una migración aplicada nunca se edita. El seed va separado.

Entidades (todas con `id`, `created_at`, `updated_at`):

- **settings:** tarifa por hora de Valery (COP), margen de ganancia por defecto (%), costos indirectos por defecto (%), redondeo de precios (ej. a múltiplos de 500), número de WhatsApp, nombre del negocio, textos de marca.
- **categories:** nombre, orden, activa. (Postres, Velas, Regalos, Otros; editable.)
- **supplies (insumos):** nombre, unidad (g, ml, unidad, m), costo por unidad, cantidad disponible, mínimo de alerta, proveedor (opcional), notas.
- **products:** nombre, categoría, tipo de cálculo (`receta`, `base_con_extras`, `combo`, `precio_fijo`), descripción, fotos, minutos de trabajo base, margen propio (opcional), publicado (sí/no), activo.
- **product\_components:** producto, tipo de componente (`insumo` o `producto`), referencia, cantidad. Permite que un combo incluya otros productos.
- **option\_groups:** producto, nombre (Tamaño, Sabor, Aroma, Personalización), tipo (única/múltiple), obligatorio, visible al cliente.
- **option\_values:** grupo, nombre, costo extra de materiales, minutos extra de trabajo, componentes de insumo que consume (opcional), precio extra sugerido.
- **clients:** nombre, teléfono, notas, origen (Instagram, WhatsApp, referido).
- **quotes:** cliente, fecha, estado (borrador, enviada, aceptada, rechazada), total de costo, total de precio, ganancia, validez, notas.
- **quote\_items:** cotización, producto, cantidad, opciones elegidas, costo calculado, precio calculado (congelados al momento de cotizar).
- **orders:** cliente, cotización (opcional), estado (pendiente, en proceso, listo, entregado, cancelado), fecha de entrega, notas, total.
- **order\_items:** igual que quote\_items.
- **stock\_movements:** insumo, tipo (compra, consumo por pedido, ajuste manual), cantidad, referencia (pedido o compra), fecha.
- **transactions:** tipo (ingreso o gasto), monto, categoría, fecha, pedido (opcional), nota.

Entidades del módulo de documentos:

- **documents:** tipo (`quote` o `receipt`), número consecutivo por tipo (por ejemplo COT-0001, CMP-0001), versión, cotización o pedido de origen, estado, fecha de emisión, `internal_snapshot text` y `client_snapshot text` (inmutables al emitir), notas para el cliente.
- **document\_share\_links:** documento, hash del token (nunca el token), vencimiento, revocado en, último acceso.
- **order\_payments:** pedido, monto, método (efectivo, transferencia, Nequi, Daviplata, otro), fecha y nota; alimenta abonos y saldo del comprobante y se refleja en `transactions`.

## 9. Lógica de cálculo de precios

Para cada línea de cotización:

1. **Costo de materiales** = suma de (cantidad × costo por unidad) de todos los insumos del producto, más los de las opciones elegidas, más el costo calculado de cada producto incluido en un combo.
2. **Costo de mano de obra** = (minutos base + minutos de opciones) ÷ 60 × tarifa por hora.
3. **Costos indirectos** = % configurable sobre materiales (gas, luz, desgaste).
4. **Costo total** = materiales + mano de obra + indirectos.
5. **Precio sugerido** = costo total ÷ (1 − margen), redondeado según configuración.
6. **Ganancia** = precio − costo total.
7. Valery puede **ajustar el precio manualmente**; la app muestra al instante la ganancia resultante y avisa si queda por debajo de un mínimo (ej. margen < 15%).
8. Los costos de un combo se recalculan automáticamente si cambia el costo de un insumo o producto componente. Las cotizaciones y pedidos ya creados conservan los valores congelados.

**Cálculos por tipo:**

- `receta` (postres): insumos por receta rinde N porciones; costo por porción disponible; escalar por cantidad de porciones.
- `base_con_extras` (velas personalizadas): base más extras activables (nombre/etiqueta, color, aroma, diseño), cada uno suma materiales y minutos.
- `combo` (bolsas de regalo): componentes mixtos de insumos y productos.
- `precio_fijo`: para casos donde ella solo quiere poner un precio.

## 10. Fases y requisitos

### Fase 0: Base del proyecto

**Entregables**

- Repositorio con pnpm, Next.js y TypeScript estricto; ESLint, Prettier, Husky y CI en GitHub Actions (lint, typecheck, pruebas, build y dependency-cruiser).
- Estructura de módulos y contenedor de composición según 6.2, más ADRs 001 a 005 (stack, ORM, autenticación, capas, sistema de diseño).
- Neon: proyecto con ramas dev, preview y prod; `DATABASE_URL` (pooled) y `DIRECT_URL` (migraciones); esquema Drizzle, migración inicial y seed de ejemplo en COP.
- Autenticación con admin sembrado, registro deshabilitado, límite de intentos, headers de seguridad y CSP.
- Kit de diseño base: tokens, tema claro y oscuro, `GlassCard`, `GlassButton`, `Field`, `Sheet`, `BottomNav` y ruta `/design`.
- PWA con manifest, íconos provisionales y service worker mínimo.
- Despliegue en Vercel con previews por PR y variables por entorno, más Dockerfile y docker-compose.yml (app y Postgres local) para correr el mismo sistema fuera de Vercel (6.4).

**Criterios de aceptación:**

- El CI falla si `domain` o `application` importan Next, Drizzle o `infrastructure`.
- Un usuario anónimo no accede a `/admin` ni a ningún endpoint privado (prueba e2e).
- Una prueba de contrato confirma que los DTOs públicos no contienen campos de costo, margen ni inventario.
- El cambio de tema claro y oscuro no produce parpadeo y respeta la preferencia del sistema.
- La app se instala desde el celular y el build de Vercel pasa sin advertencias críticas. La misma app corre con docker-compose (app y Postgres local) y pasa las pruebas de humo.

### Fase 1: Calculadora de costos y cotizaciones (MVP, solo privada)

**Historias de usuario**

1. Como Valery, configuro mi tarifa por hora, margen y redondeo una sola vez para que todos los precios los usen.
2. Como Valery, registro mis insumos con su costo para no volver a calcularlos.
3. Como Valery, creo un producto (postre, vela o combo) con su receta, minutos de trabajo y opciones.
4. Como Valery, creo una cotización eligiendo cliente, productos, cantidades y opciones, y veo el precio total y mi ganancia al instante.
5. Como Valery, comparto la cotización por WhatsApp con un texto prolijo (y opcionalmente como imagen o PDF).
6. Como Valery, guardo y reabro cotizaciones, y cambio su estado.

**Pantallas:** Inicio del admin (accesos rápidos y últimas cotizaciones), Insumos (lista y formulario), Productos (lista y editor con receta y opciones), Nueva cotización (flujo paso a paso), Detalle de cotización, Configuración.

**Criterios de aceptación**

- Crear una cotización con 3 productos toma menos de 2 minutos.
- Cambiar el costo de un insumo actualiza el costo de los productos y combos que lo usan.
- El mensaje de WhatsApp incluye cliente, detalle, total y validez, y abre `wa.me` con el texto codificado.
- Todos los montos se muestran en COP con separador de miles.

### Fase 2: Catálogo público

**Historias de usuario**

1. Como cliente, veo el catálogo organizado por categorías con fotos y precio "desde".
2. Como cliente, abro un producto, elijo tamaño, sabor o aroma y veo un precio estimado.
3. Como cliente, toco "Pedir por WhatsApp" y se abre el chat de Valery con mi selección escrita.
4. Como Valery, decido qué productos y opciones se publican, y subo fotos desde el celular.

**Pantallas:** Inicio de marca, Catálogo con pestañas por categoría, Detalle de producto con "Personaliza tu pedido", Contacto/Sobre Valery.

**Criterios de aceptación**

- Sin sesión iniciada, la red del navegador no expone costos, márgenes ni inventario.
- Los productos no publicados no aparecen ni por URL directa.
- Carga del catálogo en menos de 3 segundos en 4G, con imágenes optimizadas y carga diferida.
- SEO básico: títulos, descripciones y etiquetas para compartir en WhatsApp e Instagram (Open Graph).

### Fase 3: Pedidos, inventario y "Mis números"

**Historias de usuario**

1. Como Valery, convierto una cotización aceptada en pedido con un toque.
2. Como Valery, muevo los pedidos por estados (pendiente, en proceso, listo, entregado) y veo los de la semana por fecha de entrega.
3. Como Valery, al marcar "en proceso", la app descuenta los insumos según las recetas y opciones.
4. Como Valery, veo alertas cuando un insumo baja de su mínimo y una **lista de compras** con costo estimado de reposición.
5. Como Valery, registro compras de insumos (suma stock y actualiza costo) y ajustes manuales.
6. Como Valery, veo cuánto vendí, gasté y gané por semana y por mes, y qué productos me dejan más ganancia.
7. Como adulto responsable, exporto todos los datos a CSV como respaldo.

**Pantallas:** Pedidos (tablero o lista por estado), Detalle de pedido, Inventario con alertas, Lista de compras, Clientes, Mis números.

**Criterios de aceptación**

- El consumo de insumos se registra una sola vez por pedido (idempotente) y se revierte si el pedido se cancela.
- El stock puede quedar en negativo solo con aviso visible, nunca bloqueando el trabajo.
- Mis números muestra ingresos, gastos y ganancia con un gráfico simple y lenguaje claro.
- Producto terminado listo para venta inmediata: **opcional**, activable por producto (decisión pendiente, ver sección 12).

### Módulo transversal: documentos para el cliente (cotización y comprobante)

Valery puede generar, desde una cotización o un pedido, un documento bonito y con su marca para enviar o mostrar al cliente. No es factura electrónica ni tiene validez ante la DIAN: se llama Cotización o Comprobante de pedido, lleva el aviso "Documento informativo, sin validez tributaria" y la palabra "factura" no aparece en la interfaz ni en el documento. Conviene que la familia consulte con un contador sobre obligaciones tributarias si las ventas crecen.

**Dos vistas del mismo documento**

|  | Vista interna (solo Valery) | Vista cliente |
| --- | --- | --- |
| Contenido | Todo el detalle: materiales y cantidades de insumos por línea, costo de cada línea, mano de obra (minutos y valor), indirectos, precio, ganancia en pesos y porcentaje, alertas de margen bajo, inventario afectado y notas privadas | Marca, número, fecha, datos del cliente, líneas con nombre, opciones elegidas, cantidad, precio unitario y subtotal, descuento si lo hay, total, abono y saldo, fecha de entrega, validez, notas para el cliente, datos de pago y contacto |
| Nunca incluye | No aplica | Costos, ganancia, márgenes, mano de obra, insumos, inventario ni notas privadas |
| Acceso | Panel admin con sesión | Vista previa en el panel, modo mostrar, enlace compartible, PDF e imagen |
| Uso | Revisar y ajustar antes de enviar | Mostrar en el celular, enviar por WhatsApp o imprimir |

**Funcionalidad**

- Un interruptor "Vista interna / Vista cliente" en la pantalla del documento; la vista cliente es la vista previa exacta de lo que recibirá el cliente.
- **Modo mostrar:** pantalla completa de la vista cliente, sin navegación ni datos internos, para enseñarle el celular al cliente. Salir de este modo pide una confirmación.
- Salidas: PDF (A4 y carta), imagen PNG pensada para WhatsApp y enlace compartible.
- Numeración consecutiva por tipo, sin saltos ni duplicados. Editar un documento ya enviado crea una nueva versión (v2) y conserva la anterior.
- Estados: la cotización pasa por borrador, enviada, aceptada, rechazada y vencida; el comprobante, por abierto, con abono y pagado.
- Abonos y saldo: Valery registra pagos parciales y el comprobante muestra cuánto se pagó y cuánto falta.
- Dos plantillas iniciales (una más colorida con efecto glass y una minimalista) que usan los tokens de marca, el logo, un mensaje de agradecimiento y los datos de contacto y pago configurados en ajustes. Opcional: código QR al catálogo o a su WhatsApp.
- El documento se muestra siempre en tema claro, aunque la app esté en modo oscuro, para que imprima bien.

**Arquitectura y seguridad**

- Módulo `modules/documents` con la entidad `Document`, casos de uso `IssueDocument`, `GetInternalDocumentView`, `GetClientDocumentView` y `RevokeShareLink`, y el puerto `DocumentRenderer` para PDF e imagen. El adaptador debe ser portable (por ejemplo `@react-pdf/renderer` en Node), sin navegador headless ni funciones exclusivas de Vercel.
- Dos DTOs separados, `InternalDocumentDTO` y `ClientDocumentDTO`. El segundo se construye con lista de campos permitidos y es la única fuente del enlace, el PDF y la imagen.
- Al emitir, el documento guarda un snapshot inmutable: cambiar precios o costos después no altera documentos ya enviados.
- Enlace compartible `/d/[token]`: token aleatorio de al menos 128 bits del que solo se guarda el hash, `noindex`, `Cache-Control: no-store`, vencimiento configurable (30 días por defecto), revocable y con límite de peticiones. Muestra solo la vista cliente y no usa IDs enumerables.
- Datos personales mínimos del cliente en el documento (nombre y, opcional, teléfono).

**Reparto por fases**

- Fase 1: documento de cotización con vista interna y vista cliente, PDF e imagen, y numeración.
- Fase 2: enlace compartible `/d/[token]` y modo mostrar.
- Fase 3: comprobante de pedido con abonos y saldo, enlazado a pedidos y a Mis números.
- Fase 4: pulido de plantillas y marca.

**Criterios de aceptación**

- Generar el PDF de cliente desde una cotización toma menos de 5 segundos y se ve bien en WhatsApp y al imprimir en A4 y carta.
- Alternar entre vista interna y vista cliente no recarga la página, y una prueba automática verifica que la vista cliente, el PDF (con su texto extraído) y el enlace no contienen ningún campo interno.
- Un documento emitido no cambia aunque cambien los precios o las recetas.
- Un enlace vencido o revocado muestra un mensaje amable y ningún dato.
- La numeración no tiene saltos ni duplicados bajo concurrencia (restricción única y transacción).

### Fase 4: Marca y pulido

- Identidad visual: nombre, logo, paleta, tipografías, tono de voz, íconos de PWA e imágenes de portada, aplicados como tokens del kit de diseño sin tocar los módulos.
- Dominio propio (opcional) conectado en Vercel con HTTPS automático.
- Animaciones sutiles (respetando `prefers-reduced-motion`), estados vacíos amigables y mensajes de logro (por ejemplo, "Ya cotizaste 10 pedidos").
- Accesibilidad (contraste sobre vidrio, objetivos táctiles de 44 px, etiquetas) y rendimiento (Lighthouse superior a 90).
- Opcionales: recordatorios de entregas, plantillas de documento adicionales, Storybook completo.

## 11. Requisitos no funcionales

- **Rendimiento:** catálogo con caché y revalidación al publicar cambios (LCP menor a 2,5 s en 4G); admin dinámico con interacciones menores a 200 ms.
- **Arranque en frío de Neon:** la base escala a cero en el plan gratuito; la UI usa esqueletos de carga y reintento, y nunca se queda bloqueada.
- **Conexiones:** driver estándar de Postgres con pooling configurable por variable de entorno (pooler de Neon en Vercel, conexión directa en un VPS).
- **Disponibilidad:** depende de planes gratuitos; mensajes de error claros y exportación de respaldo.
- **Offline básico:** el admin abre con la última información en caché; las escrituras requieren conexión (v1).
- **Compatibilidad:** Chrome y Safari móvil recientes; escritorio secundario.
- **Pruebas:** TDD solo sobre lo crítico (ver 6.6), casos de uso probados con repositorios en memoria, e2e de los flujos críticos (cotizar, publicar producto, pedido a consumo de stock) y pruebas de contrato de los DTOs públicos.
- **Accesibilidad:** WCAG AA en ambos temas, navegación por teclado y lectores de pantalla.
- **Observabilidad:** logs estructurados sin datos personales y errores reportados (Sentry opcional).
- **Localización:** español de Colombia centralizado en un diccionario, listo para otros idiomas.

## 12. Preguntas abiertas y supuestos

**Supuestos actuales**

- Un solo admin (Valery) y un adulto con acceso de supervisión.
- Los pedidos entran por WhatsApp; no hay pago ni checkout en línea.
- Moneda COP, un solo punto de venta, sin impuestos en las cotizaciones (v1).
- Riesgo a resolver antes del lanzamiento público: según sus términos, el plan gratuito de Vercel (Hobby) es para uso personal y no comercial. Verificar los términos vigentes; si el negocio cuenta como uso comercial, el adulto responsable decide entre el plan de pago de Vercel o un hosting gratuito compatible con Next.js. La arquitectura limpia hace que ese cambio no afecte el código de negocio.
- Neon en plan gratuito escala a cero y tiene límites de almacenamiento y de ventana de restauración; revisar cuotas vigentes al crear el proyecto.

**Por definir con Valery y su familia**

1. ¿Cómo calcula hoy el precio de una vela personalizada o una bolsa de regalo (precio fijo, suma a ojo, copia a otros)?
2. ¿Vende por encargo, o también deja producto terminado para entrega inmediata?
3. ¿Cuál es su tarifa por hora deseada y su margen objetivo?
4. Nombre del negocio, colores, gustos de estilo y referencias visuales.
5. ¿Hace domicilios o solo entrega en persona? ¿Cobra envío?
6. ¿Quién será el titular legal de las cuentas y del dominio?
7. ¿Quiere compartir cotizaciones como texto de WhatsApp, imagen o PDF?

## 13. Instrucciones para el agente de IA

1. Leer las secciones 6, 7 y 15 a 22 antes de escribir código: son restricciones obligatorias.
2. Construir por fases en orden; no avanzar sin cumplir los criterios de aceptación de la actual.
3. En cada fase, trabajar con TDD y de adentro hacia afuera: prueba que falla, dominio, casos de uso con puertos, adaptadores y al final la UI. Las pruebas siguen la política de 6.6: solo lo crítico, sin pruebas de relleno.
4. Prohibido importar `drizzle-orm`, Neon, Next o Zod dentro de `domain`, e importar `infrastructure` desde `presentation`; se hace cumplir con dependency-cruiser en CI. Las reglas de portabilidad de 6.4 y de acceso a datos de 6.5 son igual de obligatorias.
5. Nunca enviar entidades al cliente: mapear a DTOs, con DTOs públicos y privados separados.
6. Recalcular siempre los precios en el servidor con la misma función pura del dominio, también para el precio "desde" del catálogo.
7. Los primitivos de shadcn se usan solo dentro de `shared/ui`; los módulos consumen el kit propio y los tokens de diseño, sin colores fijos.
8. Todo texto de interfaz en español colombiano, centralizado en el diccionario.
9. Datos de ejemplo realistas en COP: una torta, un postre individual, una vela mediana y una bolsa de regalo con vela y brownie.
10. Documentar en el README y en ADRs: despliegue, variables de entorno, respaldos, restauración y cada decisión técnica.
11. Ante ambigüedad, elegir la opción más simple y registrarla como supuesto en un ADR.
12. Commits pequeños con Conventional Commits y un pull request por entregable.

## 14. Roadmap sugerido

| Fase | Contenido | Resultado visible |
| --- | --- | --- |
| 0 | Base, seguridad, PWA | App instalable con login |
| 1 | Insumos, productos, cotizaciones | Valery cotiza sin hacer cuentas |
| 2 | Catálogo público y WhatsApp | Clientes piden desde un link |
| 3 | Pedidos, inventario, números | Control del negocio completo |
| 4 | Marca y pulido | Producto con identidad propia |

## 15. Protocolo de trabajo del agente (obligatorio)

Este PRD es la fuente de verdad y aplica a cualquier modelo o sesión. El agente no depende de su memoria sino de los archivos del repositorio, y lo que no esté en el PRD no se implementa.

**Archivos de continuidad (se crean en la Fase 0)**

- `AGENTS.md` en la raíz: resumen de máximo 100 líneas con las reglas de capas, portabilidad, acceso a datos, pruebas y seguridad, y los comandos del proyecto. Se lee al iniciar cada sesión.
- `docs/progress.md`: tarea actual, tareas hechas, bloqueos y siguiente tarea. Se actualiza al terminar cada tarea.
- `docs/adr/`: una decisión por archivo (contexto, decisión, consecuencias).
- `docs/runbooks/`: mudanza a un VPS, respaldos e incidentes.

**Precedencia si hay conflicto:** 1) seguridad (sección 7); 2) arquitectura, portabilidad y acceso a datos (6.1, 6.4, 6.5); 3) criterios de aceptación de la fase; 4) reglas de negocio y casos dorados (sección 17); 5) preferencias de diseño.

**Flujo por tarea**

1. Leer `AGENTS.md`, `docs/progress.md` y las secciones del PRD que aplican.
2. Escribir un plan corto (archivos a tocar, pruebas críticas y riesgos) antes de programar.
3. Hacer una sola tarea del backlog a la vez, con el alcance mínimo y sin refactors ni mejoras ajenas a ella.
4. Aplicar TDD en lo crítico (6.6).
5. Ejecutar `pnpm verify` (lint, tipos, pruebas, dependency-cruiser, gitleaks y build); una tarea con `verify` en rojo no está terminada.
6. Actualizar `docs/progress.md` y abrir un pull request que diga qué se hizo, qué criterio de aceptación cumple, qué pruebas críticas agregó, qué supuestos tomó y qué quedó pendiente.

**Detenerse y preguntar (no suponer) cuando:**

- La tarea exige una dependencia fuera de la lista de la sección 19.
- Implica cambiar el modelo de datos de una forma no descrita.
- Contradice el PRD o dos secciones se contradicen entre sí.
- Toca autenticación, autorización, subida de archivos o enlaces compartibles de forma distinta a la especificada.
- Las reglas de negocio son ambiguas.
- El cambio supera unos 15 archivos o no cabe en un pull request revisable.

Mientras espera respuesta, el agente avanza en tareas no bloqueadas y registra la duda en `docs/progress.md`.

**Prohibido**

- Inventar APIs: antes de usar una librería (Next.js, el ORM, la autenticación, Serwist) se consulta la documentación oficial de la versión instalada. Las versiones se fijan y no se actualizan dentro de una tarea.
- Agregar funcionalidades, pantallas, campos o dependencias no listadas.
- Dejar código comentado, TODOs sin registrar, secretos o datos reales en el repositorio.
- Desactivar reglas de lint, pruebas o checks de CI para que una tarea pase.
- Escribir textos de interfaz en inglés o usar colores y valores fijos fuera de los tokens.
- Usar datos de producción en pruebas.

**Calidad de código**

- TypeScript estricto sin `any` (cualquier excepción lleva un comentario con el motivo).
- Funciones cortas con un solo propósito, archivos de menos de unas 300 líneas y sin números mágicos (constantes con nombre).
- Comentarios solo para explicar el porqué; errores manejados de forma explícita.
- Los componentes de UI no contienen lógica de negocio.

## 16. Glosario y convenciones de nombres

Idioma: identificadores, archivos, tablas y commits en inglés; textos de interfaz y documentos para el cliente en español colombiano. Los valores en español que aparecen en este PRD se implementan con los nombres en inglés de esta tabla.

| En el PRD y la interfaz | En el código |
| --- | --- |
| insumo | `supply` |
| receta | `recipe` |
| producto | `product` |
| opción o extra | `option_group`, `option_value` |
| tipos de cálculo: receta, base con extras, combo, precio fijo | `recipe`, `base_with_extras`, `bundle`, `fixed_price` |
| cotización | `quote` |
| comprobante | `receipt` |
| pedido | `order` |
| cliente | `client` |
| mano de obra | `labor` |
| costos indirectos | `overhead` |
| margen / ganancia | `margin` / `profit` |
| abono / saldo | `payment` / `balance` |
| alerta de stock / lista de compras | `low_stock_alert` / `shopping_list` |
| estados de pedido: pendiente, en proceso, listo, entregado, cancelado | `pending`, `in_progress`, `ready`, `delivered`, `cancelled` |
| estados de cotización: borrador, enviada, aceptada, rechazada, vencida | `draft`, `sent`, `accepted`, `rejected`, `expired` |

Convenciones: archivos en kebab-case, componentes en PascalCase, casos de uso con verbo y sustantivo (`CreateQuote`), puertos `QuoteRepository` y adaptadores `DrizzleQuoteRepository`, DTOs con sufijo `DTO`, y commits con Conventional Commits. Los márgenes se guardan en puntos básicos (40% = 4000).

## 17. Reglas de cálculo y casos dorados

El motor de precios debe reproducir exactamente estos resultados; son las primeras pruebas que se escriben (6.6).

**Reglas exactas**

- La mano de obra es `round(minutos × tarifa por hora ÷ 60)` y los indirectos son `round(materiales × porcentaje)`, redondeando al peso entero (mitad hacia arriba).
- Costo total = materiales + mano de obra + indirectos.
- Precio unitario = costo total ÷ (1 − margen), redondeado hacia arriba al múltiplo configurado (500 por defecto), de modo que nunca baja del margen.
- Ganancia = precio − costo total; el porcentaje de ganancia se calcula sobre el precio. Se avisa si queda por debajo de 15%.
- Un producto incluido en un combo aporta su costo total; la mano de obra y los indirectos del combo se calculan solo sobre sus propios insumos y minutos.
- El total de una línea es el precio unitario redondeado multiplicado por la cantidad.

**Casos dorados** (parámetros de ejemplo para pruebas: tarifa 8.000 COP por hora, indirectos 10%, margen 40%, redondeo a 500; no son los valores reales de Valery)

| Caso | Datos | Mano de obra | Indirectos | Costo total | Precio final | Ganancia |
| --- | --- | --- | --- | --- | --- | --- |
| A. Torta | Materiales 20.000; 90 min | 12.000 | 2.000 | 34.000 | 57.000 (sin redondear 56.666,67) | 23.000 (40,35%) |
| B. Vela personalizada | Base 9.000 + etiqueta 1.500 + aroma especial 2.500 = 13.000; 30 min base + 40 min de personalización | 9.333 | 1.300 | 23.633 | 39.500 (sin redondear 39.388,33) | 15.867 (40,17%) |
| C. Bolsa de regalo con vela | Materiales propios 4.000; incluye 1 vela de costo total 15.000; 20 min | 2.667 | 400 | 22.067 | 37.000 (sin redondear 36.778,33) | 14.933 (40,36%) |
| D. Tres tortas | 3 × caso A |  |  | 102.000 | 171.000 | 69.000 |

## 18. Backlog inicial (Fases 0 y 1)

Las tareas se hacen en orden y una a la vez (sección 15). Al comenzar cada fase posterior, el agente propone su backlog con el mismo formato y espera la aprobación de una persona antes de programar.

| ID | Tarea | Resultado verificable |
| --- | --- | --- |
| F0-01 | Repositorio con pnpm, Next.js, TypeScript estricto, ESLint, Prettier, Husky y el script `pnpm verify` | `pnpm verify` pasa en limpio |
| F0-02 | Estructura de módulos, `Money` y `Result` en `shared/domain`, y contenedor de composición | dependency-cruiser falla ante una violación de capas |
| F0-03 | Configuración y variables de entorno validadas con Zod, más `.env.example` | La app no arranca si falta una variable |
| F0-04 | Esquema inicial, migración y seed de ejemplo en COP | La migración y el seed corren en Postgres local y el seed es repetible |
| F0-05 | Dockerfile y docker-compose con la app y Postgres | `docker compose up` deja la app funcionando |
| F0-06 | Autenticación con admin sembrado, 2FA, límite de intentos y rutas de admin protegidas | Prueba e2e: un anónimo no entra a `/admin` |
| F0-07 | Seguridad base: headers, CSP, `audit_logs`, gitleaks y `pnpm audit` en CI | CI falla ante un secreto o una vulnerabilidad alta |
| F0-08 | Kit de diseño base: tokens claro y oscuro, `GlassCard`, `GlassButton`, `Field`, `BottomNav` y la ruta `/design` | Ambos temas se ven en `/design` y pasan el contraste AA |
| F0-09 | PWA y despliegue en Vercel con previews por PR | La app se instala desde el celular y cada PR tiene su preview |
| F0-10 | Documentación de continuidad: `AGENTS.md`, `docs/progress.md`, ADRs 001 a 006 y esqueleto de runbooks | Los archivos existen y están al día |
| F1-01 | Value objects y motor de precios con los casos dorados A a D (TDD) | Los cuatro casos pasan exactamente |
| F1-02 | Configuración de tarifa por hora, margen, indirectos y redondeo | Los cambios se guardan y alimentan el motor |
| F1-03 | Insumos: crear, editar y archivar con costo por unidad | Las validaciones se cubren con una sola prueba parametrizada |
| F1-04 | Productos y recetas con los cuatro tipos de cálculo y sus opciones | Se puede crear una torta, una vela con extras y un combo |
| F1-05 | Recálculo de costos de productos y combos al cambiar un insumo | Prueba crítica del recálculo en cadena |
| F1-06 | Clientes mínimos, con creación rápida desde la cotización | Un cliente se crea sin salir del flujo |
| F1-07 | Nueva cotización paso a paso con precio y ganancia en vivo y ajuste manual con aviso de margen bajo | Cotizar tres productos toma menos de 2 minutos |
| F1-08 | Guardado y estados de cotización con numeración COT | Sin saltos ni duplicados (prueba crítica) |
| F1-09 | Documento de cotización: vista interna, vista cliente, PDF e imagen | Prueba de que la vista cliente y el texto del PDF no contienen campos internos |
| F1-10 | Compartir por WhatsApp con el texto armado | El botón abre `wa.me` con el mensaje codificado |
| F1-11 | Cierre de fase: revisar criterios de aceptación y de seguridad | Lista de verificación completada en el pull request |

## 19. Dependencias permitidas

Solo se pueden usar estas librerías; cualquier otra necesita un ADR y la aprobación de una persona. Todas se instalan con versión exacta, nunca con `latest`.

| Categoría | Permitido |
| --- | --- |
| Base | Next.js, React, TypeScript |
| Estilos y UI | Tailwind CSS, shadcn/ui y Radix (con class-variance-authority, clsx, tailwind-merge, sonner, vaul, cmdk, embla-carousel-react, react-day-picker y recharts), `next-themes`, `lucide-react`, `motion` (desde la Fase 4) |
| Datos | Drizzle ORM y drizzle-kit (o Prisma, según el ADR del ORM), driver estándar de Postgres (`postgres` o `pg`) |
| Validación y formularios | Zod, React Hook Form |
| Estado de cliente | TanStack Query |
| Autenticación | Better Auth (o Auth.js, según el ADR) |
| Documentos y PWA | `@react-pdf/renderer`, Serwist |
| Utilidades | `date-fns`, `pino` |
| Pruebas y calidad | Vitest, Playwright, ESLint, Prettier, Husky, lint-staged, dependency-cruiser, gitleaks |
| Prohibido sin ADR | Otras librerías de componentes (MUI, Chakra), CSS-in-JS, ORMs adicionales, gestores de estado global (Redux, Zustand), moment.js y lodash completo |

## 20. Guía de diseño y componentes (mobile-first)

Esta sección amplía la 6.3; si hay conflicto, prevalece esta. Meta: una sola estética en toda la app, construida con pocos patrones reutilizables, pensada primero para el celular, con tablet y escritorio igual de cuidados (ver 20.13).

### 20.1 Responsive: el celular es el diseño principal

- Se diseña y se programa primero para móvil (referencia 360 × 800 y 390 × 844). Los estilos sin prefijo son los de móvil y se amplían con `md:` y `lg:`; está prohibido diseñar para escritorio y recortar después.
- Todo debe ser responsive: ninguna pantalla puede tener scroll horizontal en 360 px.

| Breakpoint | Ancho | Uso |
| --- | --- | --- |
| base | desde 0 | Celular (diseño principal) |
| `sm` | 640 px | Celulares grandes y horizontal |
| `md` | 768 px | Tablet: más columnas y barra lateral |
| `lg` | 1024 px | Escritorio |
| `xl` | 1280 px | Escritorio amplio; contenido con ancho máximo de 1200 px (catálogo) o 1280 px (admin) |

- Márgenes laterales de 16 px en móvil y 24 px desde `md`.
- Navegación: en móvil, `BottomNav` con 4 o 5 destinos y un botón flotante para la acción principal ("Nueva cotización"); desde `md`, barra lateral colapsable. El sitio público usa un encabezado simple con logo, selector de tema y botón de WhatsApp, y las categorías como chips con scroll horizontal.
- Zona del pulgar: las acciones principales van en la mitad inferior de la pantalla; objetivos táctiles de al menos 44 × 44 px y separación mínima de 8 px.
- Formularios: una columna, etiquetas visibles, `inputmode` y `autocomplete` correctos (teclado numérico en montos), texto de inputs de al menos 16 px para evitar el zoom de iOS, flujos largos en pasos (`Stepper`) y barra de acción fija abajo respetando `env(safe-area-inset-bottom)`.
- Tablas: en móvil se muestran como tarjetas o listas (`ResponsiveList`); una tabla real solo desde `md`.
- Diálogos: en móvil son una hoja inferior (`Sheet`), en escritorio un `Dialog` centrado.
- Usar `100dvh` en lugar de `100vh`, `viewport-fit=cover`, imágenes con `next/image`, `sizes` y proporción fija, y nada que dependa solo de `hover` o de gestos (siempre hay una alternativa con botón).
- Cada pull request visual se revisa en 360, 390, 768, 1024, 1280, 1440 y 1920 px, en tema claro y oscuro, usando la ruta `/design` y una lista de verificación manual (sin pruebas automáticas de capturas, según 6.6).

### 20.2 Estética y tokens

- Estilo: glassmorphism suave, juvenil y limpio, con degradados suaves, esquinas redondeadas y microinteracciones discretas. Sin recargar: el vidrio se usa en la barra de navegación, tarjetas destacadas, hojas y encabezados.
- Niveles de superficie: nivel 0 fondo con degradado; nivel 1 vidrio (tarjetas destacadas y navegación); nivel 2 superficie sólida (formularios largos, tablas y listas densas, para que se lea bien); nivel 3 capa superpuesta (hojas y diálogos).
- Espaciado en base de 4 px (4, 8, 12, 16, 24, 32, 48), radios (8, 12, 16, 24 y completo), blur (8, 16 y 24 px), duraciones (120, 200 y 320 ms) y sombras definidas como tokens; no se usan valores sueltos.
- Tipografía: dos familias cargadas con `next/font` (texto y títulos), escala de 12, 14, 16, 18, 20, 24, 30 y 36 px, pesos 400, 500, 600 y 700, y `tabular-nums` en todo monto de dinero.
- Iconos: solo `lucide-react`, en 16, 20 y 24 px con trazo uniforme; los emojis no hacen de iconos de interfaz.
- Fotos de producto en proporción 1:1 o 4:5 con un marcador de posición (degradado e icono de categoría) cuando no hay foto.

### 20.3 Catálogo de componentes

Tres capas, de abajo hacia arriba. Los módulos solo consumen las capas 2 y 3; los primitivos se usan solo dentro de `shared/ui`.

| Capa | Componentes |
| --- | --- |
| 1. Primitivos (shadcn y Radix) | Button, Input, Textarea, Select, Combobox, Checkbox, Switch, RadioGroup, Tabs, Accordion, Dialog, Sheet (vaul), Popover, Tooltip, DropdownMenu, Command (cmdk), Calendar y DatePicker, Carousel (embla), Toast (sonner), Skeleton, Badge, Avatar, Progress, Separator, ScrollArea |
| 2. Kit propio | GlassCard, GlassButton, PageHeader, SectionHeader, StatCard, MoneyInput, QuantityStepper, SearchField, FilterChips, SegmentedControl (por ejemplo vista interna o cliente), StatusBadge, EmptyState, ErrorState, LoadingState, ConfirmDialog, ResponsiveList, BottomNav, SideNav, FloatingActionButton, StickyActionBar, Stepper, ProductCard, ImageGallery, PriceTag, ProfitMeter, StockBar, Timeline, ChartCard |
| 3. Compuestos por módulo | QuoteSummary, RecipeEditor, OptionGroupEditor, OrderCard, StockAlertList, DocumentPreview |

Reglas del catálogo:

- Cada componente tiene props tipadas, variantes con `class-variance-authority`, el helper `cn()` (clsx y tailwind-merge) y ninguna lógica de negocio.
- Cada componente se documenta en `/design` con todas sus variantes y estados (normal, hover, activo, foco, deshabilitado, cargando y error), en tema claro y oscuro.
- Los componentes se crean cuando una tarea los necesita, nunca por adelantado; la excepción es lo que pide la tarea F0-08 (tokens, estructura de navegación y primitivos base).
- Antes de crear un componente se busca en el kit y en shadcn; no se duplica. Si un patrón se repite dos veces, se extrae al kit.

### 20.4 Plantillas de pantalla

Cada pantalla se arma con una de estas plantillas para que la app se sienta coherente.

| Plantilla | Móvil | Tablet y escritorio | Componentes clave |
| --- | --- | --- | --- |
| Lista | Encabezado, búsqueda, chips de filtro, tarjetas y botón flotante | Barra lateral, tabla o rejilla y botón en el encabezado | PageHeader, SearchField, FilterChips, ResponsiveList, FloatingActionButton |
| Detalle | Una columna con secciones y acciones fijas abajo | Dos columnas: contenido y resumen lateral | SectionHeader, GlassCard, StickyActionBar |
| Formulario o asistente | Un paso por pantalla con barra de progreso y botón fijo abajo | Formulario en una tarjeta con pasos visibles | Stepper, Field, MoneyInput, StickyActionBar |
| Panel (Mis números) | Tarjetas de resumen apiladas, luego gráfico y lista | Rejilla de 3 o 4 columnas con gráficos | StatCard, ChartCard, ProfitMeter |
| Catálogo público | Rejilla de 2 columnas con chips de categoría | 3 columnas en `md` y 4 en `lg` | ProductCard, FilterChips |
| Producto público | Galería arriba, opciones, precio y botón de WhatsApp fijo abajo | Galería a la izquierda y opciones a la derecha | ImageGallery, PriceTag, SegmentedControl |
| Documento | Vista interna y vista cliente alternadas con un `SegmentedControl` | Ambas vistas lado a lado | DocumentPreview, SegmentedControl |

### 20.5 Estados y movimiento

- Cargando: esqueletos (`Skeleton`) con la forma del contenido, nunca un spinner a pantalla completa.
- Vacío: `EmptyState` con ilustración simple, frase amable y la acción para empezar.
- Error: `ErrorState` con mensaje claro y botón de reintentar.
- Éxito: aviso breve con `sonner`; las acciones destructivas piden confirmación con `ConfirmDialog`.
- Los cambios de estado (por ejemplo de un pedido) se reflejan de inmediato en la interfaz y se revierten si el servidor falla.
- Animaciones de 120 a 320 ms usando solo `transform` y `opacity`, con respuesta táctil (`active:scale-[0.98]`) y respeto por `prefers-reduced-motion`.

### 20.6 Reglas de estilizado y tono

- Solo utilidades de Tailwind con los tokens definidos. Prohibidos el CSS suelto, los estilos en línea, `!important`, los colores hexadecimales y los valores arbitrarios entre corchetes (salvo con un ADR).
- Los módulos no inventan colores ni espaciados propios: se arman con los componentes del kit y la escala de espaciado.
- Preferir composición (subcomponentes) a componentes con muchas propiedades booleanas.
- Todo color sale de un token con su versión clara y oscura; se prueban ambos temas.
- Textos en español de Colombia, tuteo, voz cálida y frases cortas, sin jerga financiera ("tu ganancia", no "margen bruto").
- Accesibilidad: foco visible con anillo de 2 px, contraste AA, roles ARIA mediante Radix, orden de tabulación lógico y `aria-live` en los avisos.

### 20.7 Criterios de aceptación del diseño

- Sin scroll horizontal a 360 px y objetivos táctiles de al menos 44 px en todas las pantallas.
- Tema claro y oscuro revisados, con contraste AA, también sobre vidrio.
- Cada pantalla tiene sus estados de carga, vacío y error.
- Solo se usan componentes del kit y tokens; todo componente nuevo está documentado en `/design`.
- En las páginas públicas, Lighthouse móvil con rendimiento de al menos 90 y accesibilidad de al menos 95, y un CLS menor a 0,1.

### 20.8 Mapa de navegación y rutas

Los nombres de código van en inglés, pero las rutas visibles van en español.

| Ruta | Pantalla | Plantilla | Fase |
| --- | --- | --- | --- |
| `/login` | Inicio de sesión | Formulario | 0 |
| `/admin` | Inicio del admin | Panel | 1 |
| `/admin/cotizaciones`, `/admin/cotizaciones/nueva`, `/admin/cotizaciones/[id]` | Lista, asistente y detalle de cotización | Lista, Formulario, Documento | 1 |
| `/admin/productos`, `/admin/productos/[id]` | Lista y editor de producto | Lista, Formulario | 1 |
| `/admin/insumos` | Insumos (con inventario desde la Fase 3) | Lista | 1 |
| `/admin/clientes` | Clientes | Lista | 1 |
| `/admin/documentos` | Documentos emitidos | Lista | 1 |
| `/admin/ajustes` | Tarifa, margen, marca y contacto | Formulario | 1 |
| `/` | Inicio público | Catálogo público | 2 |
| `/catalogo`, `/producto/[slug]` | Catálogo y producto | Catálogo, Producto | 2 |
| `/d/[token]` | Documento compartido (vista cliente) | Documento | 2 |
| `/admin/pedidos`, `/admin/pedidos/[id]` | Lista y detalle de pedido | Lista, Detalle | 3 |
| `/admin/numeros` | Mis números | Panel | 3 |

Navegación del admin en móvil (`BottomNav`): **Inicio, Productos, Cotizar (botón central destacado), Pedidos y Más**. "Más" abre una hoja con Insumos e inventario, Clientes, Mis números, Documentos y Ajustes. Hasta la Fase 3 los destinos que aún no existen no se muestran. En tablet y escritorio, la barra lateral lista todos los destinos.

### 20.9 Pantallas clave paso a paso

**Nueva cotización (asistente de 5 pasos).** Una barra fija abajo muestra siempre el total y el botón "Siguiente".

1. Cliente: buscar uno existente o crear uno rápido con nombre y WhatsApp.
2. Productos: lista con búsqueda y chips de categoría; tocar un producto lo agrega y `QuantityStepper` ajusta la cantidad.
3. Opciones: por cada línea, tamaño, sabor, aroma y extras con chips o `SegmentedControl`; el precio de la línea cambia en vivo.
4. Resumen: líneas, total, `ProfitMeter`, ajuste manual del precio, descuento, fecha de entrega, validez y notas para el cliente. El desglose de costos solo aparece bajo "Ver cuentas".
5. Enviar: vista previa de la vista cliente y botones para compartir por WhatsApp, descargar PDF o imagen y guardar borrador.

**Editor de producto.** Secciones plegables: Datos, Insumos y receta, Mano de obra, Opciones y extras, y Precio y publicación. Una barra fija muestra el costo y el precio sugerido en vivo. Incluye "Crear desde un ejemplo" (torta, vela, bolsa de regalo).

**Detalle de pedido.** `Timeline` de estados; un botón principal que cambia según el estado ("Empezar", "Marcar listo", "Entregado"); abonos y saldo; documentos asociados; y, antes de empezar, aviso de los insumos que faltan.

**Inicio del admin.** Saludo, tarjetas de resumen (pedidos de la semana, entregas de hoy y, desde la Fase 3, ingresos del mes), alertas de poco inventario, accesos rápidos (Nueva cotización, Nuevo producto, Registrar abono) y últimas cotizaciones.

**Inicio público.** Secciones en este orden: portada con propuesta y botón de WhatsApp; categorías; productos destacados; "Cómo pedir" en 3 pasos; "Sobre Valery"; contacto y redes; y pie de página con el aviso de datos.

### 20.10 Primer uso y lenguaje simple

Valery no disfruta las cuentas, así que la interfaz debe mostrar el resultado y esconder la complejidad.

- **Primer uso (4 pasos):** nombre del negocio; cuánto vale su hora, con una explicación sencilla y una sugerencia; ganancia deseada, con un ejemplo visual; y su primer producto desde una plantilla.
- **Modo simple por defecto:** solo precio y ganancia. Los costos desglosados quedan bajo "Ver cuentas" y la preferencia se guarda.
- **Ayuda contextual:** un ícono "?" junto a cada concepto (margen, indirectos, mano de obra) con una frase y un ejemplo con números.
- **Semáforo de ganancia (`ProfitMeter`):** verde desde 30%, amarillo entre 15% y 29%, rojo por debajo de 15%, con frases como "Buena ganancia", "Ganancia justa" y "Estás regalando tu trabajo". Los umbrales son configurables.
- **Plantillas de ejemplo editables:** torta de chocolate, vela de soya mediana y bolsa de regalo.
- Mensajes de logro discretos; sin gamificación excesiva ni notificaciones push.

### 20.11 Contenido y formatos

- **Formatos de Colombia:** moneda COP sin decimales (`$ 57.000`), fechas cortas ("12 oct 2026") y largas ("lunes 12 de octubre"), horas en formato de 12 horas, zona `America/Bogota`, cantidades con unidad (g, ml, unid.) y porcentajes con coma ("40,3 %").
- **Microtextos:** estados vacíos, errores y confirmaciones salen de un diccionario único, con tuteo, sin mayúsculas sostenidas y sin exceso de signos de exclamación.
- **Fotos:** `ImageUploader` con recorte 1:1 o 4:5, compresión a WebP (lado mayor de unos 1600 px y menos de 300 KB) antes de subir, y texto alternativo por defecto igual al nombre del producto. Una guía corta dentro de la app explica cómo tomar buenas fotos (luz natural y fondo liso).
- **Vistas previas al compartir:** imagen Open Graph de 1200 × 630 px por producto y para la página principal, para que los enlaces se vean bien en WhatsApp e Instagram.
- **Identidad técnica:** favicon, íconos de PWA (192, 512 y maskable) y pantalla de carga con la marca.

### 20.12 Privacidad en el contenido público (menor de edad)

- El sitio público no muestra el apellido, la edad, el colegio ni la dirección o ubicación exacta de Valery. Solo el nombre de la marca (o su primer nombre), una zona general opcional, el WhatsApp del negocio y las redes del negocio.
- Se recomienda un número de WhatsApp Business dedicado al negocio, administrado junto con un adulto.
- Las fotos de Valery solo se publican si la familia lo aprueba; por defecto se muestran fotos de productos.
- Un adulto revisa y aprueba el texto de "Sobre Valery" antes de publicar.
- Los formularios públicos piden solo los datos indispensables y no hay comentarios ni mensajes públicos en el sitio.

**Criterios de aceptación adicionales**

- Las pantallas siguen los flujos y las rutas de 20.8 y 20.9; el agente no agrega destinos ni pasos no definidos.
- El modo simple es el predeterminado y el desglose de costos nunca aparece en una vista pública.
- El texto "Sobre Valery" está aprobado por un adulto antes del lanzamiento público.

### 20.13 Tablet y escritorio: igual de cuidados

Principio: "móvil primero" es el orden de trabajo, no una jerarquía de calidad. Cuando Valery o un cliente abra el sitio en un computador, nada debe verse roto, estirado ni vacío. Cada pantalla tiene un diseño propio para `md`, `lg` y `xl`; estirar la versión móvil no cuenta como diseño de escritorio.

**Reglas de escritorio y tablet**

- Contenido centrado con ancho máximo (1200 px en el sitio público y 1280 px en el admin). En pantallas de 1440 a 2560 px el contenido no se estira ni queda pegado a un lado, y el fondo con degradado cubre toda la pantalla.
- Rejillas que aprovechan el ancho: catálogo de 2, 3 y 4 columnas; formularios en dos columnas desde `lg`; paneles de 3 o 4 columnas. Nunca una columna angosta flotando en un mar vacío ni líneas de texto de más de unos 75 caracteres.
- Admin en escritorio: barra lateral fija y colapsable, encabezado de página con las acciones a la derecha (en lugar del botón flotante) y vista de lista y detalle lado a lado desde `lg` en cotizaciones, pedidos y productos. En el asistente de cotización, el resumen queda en una columna lateral fija.
- Tablas reales desde `md`: encabezado fijo, columnas ordenables, texto truncado con `Tooltip`, acciones por fila accesibles con el teclado y paginación o scroll interno.
- Diálogos centrados con ancho máximo (480, 640 u 800 px) y altura máxima con scroll interno; en escritorio no se usan hojas inferiores.
- Mouse y teclado: estados de hover y de foco visibles, cursor de mano solo en elementos interactivos, navegación completa con Tab, Esc para cerrar y Enter para confirmar.
- Imágenes que no se estiran ni se pixelan: `object-fit: cover`, `sizes` hasta 1200 px y versiones para pantallas de alta densidad.
- Efecto glass: el blur es costoso en escritorio, así que se limita la cantidad de superficies con blur visibles a la vez y se mantiene el fallback a fondo sólido.
- Impresión: las cotizaciones y comprobantes tienen estilos de impresión (A4 y carta, márgenes de 15 mm, fondo claro y sin navegación).
- La interfaz sigue siendo usable con zoom al 200% y con la fuente del sistema aumentada.

**Prohibido**

- Anchos fijos en píxeles que rompan el diseño y tamaños de fuente basados solo en `vw` sin límites (usar `clamp()`).
- Ocultar problemas con `overflow-x: hidden` en el `body` o en contenedores generales.
- Ocultar funciones en escritorio que sí existen en móvil, o a la inversa.

**Matriz de verificación (cada pull request visual, en tema claro y oscuro)**

| Ancho | Dispositivo de referencia | Qué se comprueba |
| --- | --- | --- |
| 360 y 390 px | Celulares | Una columna, sin scroll horizontal, objetivos táctiles de 44 px |
| 768 px | Tablet vertical | Barra lateral, 2 o 3 columnas, diálogos centrados |
| 1024 px | Tablet horizontal y laptop pequeña | Lista y detalle lado a lado, tablas completas |
| 1280 y 1440 px | Laptop y escritorio | Ancho máximo, rejillas de 3 o 4 columnas, sin espacios vacíos excesivos |
| 1920 y 2560 px | Pantallas grandes | Contenido centrado, fondo completo, nada estirado |

Navegadores: versiones recientes de Chrome, Safari (iOS y macOS), Firefox y Edge. Además, se redimensiona la ventana de forma continua entre 320 y 2560 px comprobando que no haya saltos, cortes ni superposiciones.

**Prueba automática (compatible con la política de 6.6):** una sola prueba e2e parametrizada que recorre las rutas principales, públicas y de admin con una sesión sembrada, a 360, 768, 1280 y 1920 px, y verifica que no haya scroll horizontal ni errores en la consola. No es una prueba de capturas.

**Criterios de aceptación**

- Cada pantalla tiene su diseño definido para móvil, tablet y escritorio, y `/design` incluye un conmutador de ancho para verlo.
- Entre 320 y 2560 px nada se ve roto, cortado, superpuesto ni excesivamente vacío.
- Cada pull request visual incluye la revisión de la matriz anterior en ambos temas.
- La prueba automática de desbordamiento pasa en el CI.
- En las páginas públicas, Lighthouse de escritorio con rendimiento de al menos 90 y accesibilidad de al menos 95.

## 21. Módulo de servicios (armado, catering y otros)

Valery puede ofrecer servicios además de productos, y cotizarlos juntos en una misma cotización, pedido y comprobante: por ejemplo, el armado de bolsas de regalo o un catering de postres para un evento. El catálogo tiene dos tipos de elementos: **producto** (algo que se vende hecho) y **servicio** (un trabajo que se presta y que puede incluir productos). Esta sección prevalece sobre los apartados anteriores donde haya diferencias.

### 21.1 Tipos de servicio y cálculo

Todos usan el motor de precios de la sección 17 (mismas reglas de redondeo y margen) con una estrategia de cálculo por tipo.

| Tipo (`kind` de cálculo) | Se cobra por | Ejemplo | Cálculo base |
| --- | --- | --- | --- |
| `per_unit` | Unidad | Armado de bolsas de regalo | cantidad × (materiales + minutos por unidad) |
| `per_person` | Persona | Catering de postres | personas × (productos incluidos + materiales por persona) + mano de obra fija del evento |
| `per_hour` | Hora | Decoración o montaje | horas × tarifa + materiales |
| `per_event` | Evento | Paquete cerrado | valor base + extras elegidos |

Reglas comunes:

- Un servicio puede incluir insumos y productos ya creados, con cantidad fija o proporcional a las personas o unidades (`quantity_basis`: `fixed` o `per_unit`). Un producto incluido aporta su costo total.
- Mano de obra: minutos por unidad y minutos fijos por evento (preparación, montaje y desplazamiento).
- Mínimo: cantidad mínima (por ejemplo 15 personas) o valor mínimo; si piden menos, se cotiza con el mínimo y se muestra un aviso.
- Cargos adicionales (`fee`): transporte, personal extra, urgencia o montaje. Cada uno tiene un valor y la opción "aplicar margen", desactivada por defecto para el transporte (se cobra al costo).
- Anticipo configurable por servicio (50% por defecto) que el comprobante muestra como abono y saldo.
- Datos del evento en la línea: fecha y hora, número de personas, lugar o zona, alergias y notas.
- Anticipación mínima de pedido en días (`lead_time_days`) para avisar si la fecha pedida es muy próxima.
- Agregar un tipo de servicio nuevo es agregar una estrategia de cálculo (`PricingStrategy`) sin tocar las demás.

### 21.2 Cambios al modelo de datos

- `products.kind`: `product` o `service`, con los tipos de cálculo de 21.1 además de los existentes.
- `service_settings`: servicio, unidad de cobro, cantidad mínima, valor mínimo, minutos por unidad, minutos fijos, anticipo en puntos básicos y `lead_time_days`.
- `product_components.quantity_basis`: `fixed` o `per_unit`.
- `service_fees`: servicio, nombre, valor, `apply_margin`, `is_optional`.
- `quote_items` y `order_items`: `item_kind` (`product`, `service` o `fee`) y `line_details` (JSON serializado en texto) con los datos del evento.
- Glosario nuevo: servicio `service`, cargo adicional `fee`, anticipo `deposit`, evento `event`, por persona `per_person`, por unidad `per_unit`.
- Se aplican las convenciones de 6.5: nada de tipos propios de PostgreSQL.

### 21.3 Casos dorados de servicios

Mismos parámetros de la sección 17 (tarifa 8.000 COP por hora, indirectos 10%, margen 40%, redondeo a 500).

| Caso | Datos | Costo | Precio | Ganancia |
| --- | --- | --- | --- | --- |
| E. Armado de 20 bolsas (`per_unit`) | Por bolsa: materiales 1.500 y 10 min | Por bolsa: mano de obra 1.333 + materiales 1.500 + indirectos 150 = 2.983; total 59.660 | Por bolsa 5.000 (sin redondear 4.971,67); total 100.000 | 40.340 (40,34%) |
| F. Catering para 30 personas (`per_person`) | Por persona: 2 minipostres de 1.800 de costo total cada uno y materiales propios de 500; 180 min fijos de preparación y montaje; transporte de 15.000 al costo | Servicio: productos 108.000 + materiales 15.000 + mano de obra 24.000 + indirectos 1.500 = 148.500; transporte 15.000 | Servicio 247.500 + transporte 15.000 = 262.500 (anticipo del 50%: 131.250) | 99.000 (37,71% del total) |
| G. Cotización mixta | 1 torta (caso A) + catering (caso F) | 197.500 | 319.500 | 122.000 (38,18%) |

### 21.4 Experiencia en el admin

- "Productos" en la navegación pasa a llamarse **Catálogo**, con pestañas Productos y Servicios. Rutas: `/admin/catalogo`, `/admin/catalogo/productos/[id]` y `/admin/catalogo/servicios/[id]` (reemplazan a `/admin/productos` de 20.8).
- Editor de servicio con secciones plegables: Datos, Cobro (tipo y mínimos), Incluye (insumos y productos, con base fija o por persona o unidad), Mano de obra, Cargos adicionales, Anticipo y anticipación, y Publicación. Una barra fija muestra el costo y el precio sugerido en vivo y un ejemplo con una cantidad de prueba.
- En el paso 2 de la nueva cotización hay chips Productos y Servicios; en una línea de servicio la cantidad cambia de etiqueta ("personas", "bolsas", "horas") y aparecen los datos del evento y los cargos adicionales opcionales.
- El `ProfitMeter` funciona por línea y para el total; el documento del cliente lista productos y servicios con su descripción, por ejemplo "Catering de postres, 30 personas, 12 oct 2026, 4:00 p. m.".
- Plantillas de ejemplo editables: armado de bolsas de regalo y catering de postres.

### 21.5 Arquitectura y seguridad

- Los servicios viven en el módulo `catalog`; el módulo `pricing` agrega una estrategia por tipo, como funciones puras.
- `PublicServiceDTO` sin costos, márgenes ni insumos; los pedidos de servicios entran solo por WhatsApp.
- Al pasar un pedido a "en proceso", el inventario se descuenta en cascada: los insumos del servicio y los de cada producto incluido.
- Cada pantalla y regla nueva respeta las secciones 6, 7 y 20.

### 21.6 Reparto por fases y tareas

Las tareas S1 se insertan antes de la tarea de cierre F1-11.

| ID | Tarea | Resultado verificable |
| --- | --- | --- |
| S1-01 | Extender el modelo y el motor con `kind`, las estrategias de servicio y los cargos | Los casos E, F y G pasan exactamente |
| S1-02 | Editor de servicios en el admin | Se crean el armado de bolsas y el catering |
| S1-03 | Cotizar mezclando productos y servicios, con datos del evento y mínimos | Cotización mixta correcta y aviso de mínimo |
| S1-04 | Vista cliente del documento con servicios | Prueba de que no hay campos internos |
| S2-01 | Página pública de servicios y solicitud por WhatsApp (ver 22.5) | Los criterios de 22.10 |
| S3-01 | Datos del evento en el pedido, lista por fecha y descuento de inventario en cascada | Un pedido de catering descuenta los insumos de los postres incluidos |
| S3-02 | Anticipo y saldo en el comprobante de servicios | El saldo se calcula bien con abonos parciales |

**Criterios de aceptación**

- Los casos E, F y G reproducen los resultados de 21.3.
- Se puede emitir una sola cotización y un solo comprobante con productos y servicios.
- La vista cliente y el catálogo público de servicios no exponen costos ni márgenes.

## 22. Sitio público del cliente: contenido, controles y comportamiento

El sitio es sencillo a propósito: una vitrina rápida que lleva al cliente a pedir por WhatsApp. Esta sección define qué hay en cada página, qué controles tiene y cómo se comporta, para que el agente no invente nada. Aplica con las secciones 20 (diseño) y 7 (seguridad). Todo el contenido lo edita Valery desde el admin (22.8).

### 22.1 Estructura global

| Elemento | Contenido y comportamiento |
| --- | --- |
| Encabezado | Logo o nombre de la marca, enlaces (Inicio, Catálogo, Servicios, Sobre mí, Contacto), selector de tema claro, oscuro o sistema y botón "Pedir por WhatsApp". En móvil, menú en hoja inferior; el encabezado se mantiene visible al hacer scroll hacia arriba |
| Botón flotante de WhatsApp | Visible en móvil en todas las páginas públicas, abajo a la derecha, sin tapar los botones fijos de otras pantallas. Abre el chat con un mensaje genérico |
| Pie de página | Redes del negocio, WhatsApp, zona de entrega general, enlaces a Privacidad y Aviso, y el texto "Documento informativo, sin validez tributaria" donde aplique |
| Páginas especiales | 404 con enlace al catálogo, error 500 amable con botón de reintentar y página "Enlace vencido" para documentos |
| Rutas | `/`, `/catalogo`, `/producto/[slug]`, `/servicios`, `/servicio/[slug]`, `/sobre-mi`, `/contacto`, `/preguntas`, `/privacidad`, `/aviso`, `/d/[token]` |

### 22.2 Inicio (`/`)

Secciones en este orden; cada una se puede ocultar desde el admin.

| Sección | Contenido | Controles |
| --- | --- | --- |
| Portada | Titular, subtítulo corto, imagen o degradado de marca | Botón principal "Ver catálogo" y botón secundario "Pedir por WhatsApp" |
| Categorías | Postres, Velas, Regalos, Servicios y las que se creen, con ícono o imagen | Cada una enlaza al catálogo filtrado |
| Destacados | Hasta 8 productos o servicios marcados como destacados | Tarjetas con enlace al detalle |
| Cómo pedir | 3 pasos: elige, personaliza y envíanos tu pedido por WhatsApp | Sin controles |
| Servicios | Tarjetas de los servicios publicados con "Cotiza tu evento" | Enlace a `/servicios` |
| Sobre mí | Texto corto y una foto (solo si la familia la aprobó) | Enlace a `/sobre-mi` |
| Preguntas frecuentes | Las 4 primeras preguntas en acordeón | Enlace a `/preguntas` |
| Contacto | WhatsApp, redes y zona de entrega | Botones de contacto |

### 22.3 Catálogo (`/catalogo`)

- Controles: búsqueda por texto; chips de categoría con scroll horizontal en móvil; filtro de tipo (Todos, Productos, Servicios); orden (Destacados, Nombre, Precio de menor a mayor y de mayor a menor); en escritorio, los filtros en una columna lateral.
- Rejilla: 2 columnas en móvil, 3 desde `md` y 4 desde `lg`, con carga progresiva (botón "Ver más", sin scroll infinito).
- Tarjeta de producto: foto 1:1 o 4:5, nombre, precio "Desde $X" y una insignia opcional (Nuevo, Por encargo, Agotado temporalmente). Todo el cuadro es un enlace al detalle.
- Estados: cargando con esqueletos, sin resultados con mensaje y botón "Quitar filtros", y error con botón de reintentar. Los filtros y el orden quedan en la URL para poder compartir la búsqueda.

### 22.4 Producto (`/producto/[slug]`)

| Zona | Contenido | Controles y comportamiento |
| --- | --- | --- |
| Galería | Hasta 6 fotos | Carrusel con miniaturas, deslizar en móvil y flechas en escritorio; ampliar al tocar |
| Información | Nombre, categoría, descripción, qué incluye, tiempo de preparación o anticipación mínima y avisos (alérgenos y conservación) | Texto, sin controles |
| Opciones | Tamaño, sabor, aroma o personalización, según el producto | Chips o selector; las obligatorias se marcan y el botón de pedido no se activa hasta elegirlas |
| Cantidad | Número de unidades | `QuantityStepper` con mínimo 1 y máximo configurable |
| Datos del pedido | Fecha deseada (opcional) y notas (por ejemplo texto a personalizar) | Selector de fecha que bloquea fechas anteriores a la anticipación mínima y campo de texto de hasta 300 caracteres |
| Precio | "Desde $X" y, al elegir opciones, "Precio estimado $Y" con la nota "Valery te confirma el precio final por WhatsApp" | Calculado en el servidor con el motor de precios; nunca muestra costos |
| Acción | Botón "Pedir por WhatsApp" (fijo abajo en móvil) | Abre el chat con el mensaje de 22.7; botón secundario "Compartir" |
| Relacionados | Hasta 4 productos de la misma categoría | Tarjetas |

### 22.5 Servicios (`/servicios` y `/servicio/[slug]`)

- Lista: tarjetas con foto, nombre, resumen y una frase de precio (por ejemplo "Desde $8.250 por persona", calculada en el servidor con la cantidad mínima, o un texto manual que Valery pueda poner).
- Detalle: descripción, qué incluye, cómo se cotiza, cantidad o personas mínimas, anticipación mínima, galería, preguntas frecuentes propias y ejemplos de trabajos anteriores si los hay.
- Formulario de solicitud (no guarda datos, solo arma el mensaje de WhatsApp): servicio, fecha del evento, número de personas o cantidad, zona, alergias y notas. Valida cantidad mínima y fecha con la anticipación mínima y avisa con un mensaje claro, sin bloquear la solicitud.
- Botón "Cotiza por WhatsApp" con el mensaje de 22.7. Los servicios no muestran un precio final, solo "Desde" o "Cotizable".

### 22.6 Otras páginas

- **Sobre mí:** historia corta, valores y proceso de trabajo, con la privacidad de 20.12 (sin apellido, edad, colegio ni ubicación exacta).
- **Contacto:** botón de WhatsApp, enlaces a redes, zona de entrega general, horario de atención y tiempos de respuesta. Sin formulario que guarde datos.
- **Preguntas frecuentes:** acordeón con tiempos de entrega, anticipación mínima, formas de pago, alérgenos, personalización, cambios y cancelaciones.
- **Privacidad y Aviso:** tratamiento de datos (Ley 1581 de 2012), que el sitio no usa cuentas de clientes ni cookies de seguimiento, y que las cotizaciones y comprobantes son informativos y sin validez tributaria.
- **Documento compartido (`/d/[token]`):** vista cliente del documento con botones "Descargar PDF", "Guardar imagen" y "Escribir por WhatsApp"; muestra la marca, el estado y la fecha de validez.

### 22.7 Mensajes de WhatsApp

Se arman en el navegador con datos del producto y lo que el cliente eligió, nunca con datos personales, y se envían a `wa.me` codificados. Máximo 1000 caracteres; si se supera, se recortan las notas.

```text
Producto:
Hola, quiero pedir:
- {producto} ({opciones}) x{cantidad}
Precio estimado: {precio}
Fecha deseada: {fecha}
Notas: {notas}
Enlace: {url}

Servicio:
Hola, quiero cotizar un servicio:
Servicio: {servicio}
Fecha del evento: {fecha}
Personas o cantidad: {n}
Zona: {zona}
Alergias o notas: {notas}
Enlace: {url}

Genérico:
Hola, vi tu catálogo y quiero hacer un pedido.
```

### 22.8 Contenido editable desde el admin

Nueva pantalla `/admin/sitio` con estos campos, todos validados y guardados en la base de datos (tabla clave-valor `site_content`, sin contenido escrito en el código):

- Marca: nombre, eslogan, logo y colores (Fase 4).
- Inicio: titular, subtítulo, imagen de portada, secciones visibles y su orden.
- Sobre mí: texto y foto (con una casilla "aprobado por un adulto" que debe estar marcada para publicar).
- Contacto: WhatsApp, redes, zona de entrega, horario y tiempos de respuesta.
- Preguntas frecuentes: lista ordenable de pares pregunta y respuesta.
- Avisos globales: una barra opcional con mensaje (por ejemplo "Pedidos de diciembre hasta el 15").
- Por producto y servicio: publicado, destacado, orden, insignia, disponibilidad (disponible, por encargo o agotado temporalmente), anticipación mínima y texto de precio manual opcional.
- Vista previa del sitio público antes de publicar cambios.

### 22.9 SEO, rendimiento y analítica

- Metadatos por página (título, descripción, Open Graph, imagen 1200 × 630) y `sitemap.xml` y `robots.txt` generados; los documentos compartidos y el admin no se indexan.
- Datos estructurados `Product` en los productos; sin datos estructurados de ubicación o dirección (privacidad de 20.12).
- Catálogo y detalles en caché con revalidación al publicar cambios; imágenes con `next/image`; metas de rendimiento de 20.7 y 20.13.
- Analítica opcional y sin cookies de seguimiento (conteo de visitas y clics a WhatsApp, sin identificar personas), detrás de un puerto intercambiable. Sin banner de cookies mientras no se usen cookies de seguimiento.
- Accesibilidad: foco visible, textos alternativos, contraste AA, acordeones y carruseles operables con teclado.

### 22.10 Criterios de aceptación del sitio público

- Todas las páginas de 22.1 existen, con la estructura, los controles y los estados de esta sección, en móvil, tablet y escritorio.
- Ninguna página ni respuesta pública contiene costos, márgenes, insumos, datos de clientes o notas privadas (prueba de contrato de los DTOs públicos).
- Los tres mensajes de WhatsApp se arman correctamente, codificados, sin datos personales y con el límite de longitud.
- El botón de pedido de un producto con opciones obligatorias no se activa hasta elegirlas; las fechas anteriores a la anticipación mínima se bloquean o se avisan.
- Todo texto del sitio sale del contenido editable del admin; no hay textos fijos que Valery no pueda cambiar, salvo los legales.
- El texto "Sobre mí" solo se publica con la aprobación de un adulto marcada.
- Un producto marcado como no publicado devuelve 404 aunque se conozca la URL.
