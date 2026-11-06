# Pulso CRM

CRM especializado para gimnasios: interesados, socios, empresas con convenio, planes, sedes, oportunidades con embudo configurable, actividades realizadas e historial comercial, con permisos por rol validados en el servidor.

- **Frontend:** HTML, CSS y JavaScript sin build, publicado en GitHub Pages.
- **API:** Node.js + Express.
- **Base de datos:** SQLite en local; Turso (compatible con SQLite) publicado.

## Levantarlo en local

Requiere Node 20 o superior.

```bash
npm install
npm start
```

Abrir http://localhost:8420. La base se crea y se carga sola en `data/pulso.db`.

| Comando | Qué hace |
|---|---|
| `npm start` | Levanta API y frontend en el puerto 8420 |
| `npm test` | Corre las pruebas de la API (reglas y permisos por rol) |
| `npm run seed` | Crea las tablas y carga la demo si la base está vacía |
| `npm run seed:reset` | Borra todo y vuelve a cargar la demo |

## Usuarios de demostración

Contraseña de todos: `pulso123`

| Rol | Email |
|---|---|
| Administrador | `admin@pulsocrm.com` |
| Responsable comercial | `responsable@pulsocrm.com` |
| Vendedor | `vendedor@pulsocrm.com` |
| Vendedor (segundo, para comparar carteras) | `vendedor2@pulsocrm.com` |
| Vendedor inactivo (no puede ingresar) | `tomas.vera@pulsocrm.com` |

Son credenciales públicas de demostración con datos ficticios: no usar datos reales con ellas.

## Permisos

| Acción | Administrador | Responsable comercial | Vendedor |
|---|---|---|---|
| Ver clientes y oportunidades | Todo | Todo | Solo lo asignado |
| Crear y editar clientes y oportunidades | Sí | Sí | Solo lo suyo |
| Reasignar clientes y oportunidades | Sí | Sí | No |
| Cambiar etapa, cerrar, registrar actividad | Sí | Sí | Solo lo suyo |
| Reabrir o modificar una cerrada (con motivo, queda registrado) | Sí | Sí | No |
| Dar de baja (baja lógica) | Sí | Sí | Solo lo suyo |
| Eliminar un registro sin historial | Sí | No | No |
| ABM de planes | Sí | Solo lectura | Solo lectura |
| Usuarios y configuración | Sí | No | No |

## Publicación (gratis)

El frontend queda en GitHub Pages, sin cambios en su configuración. La API corre en [Vercel Hobby](https://vercel.com/docs/plans/hobby) y la base en [Turso](https://turso.tech/pricing), ambos sin costo ni tarjeta para este uso.

1. Crear la base en Turso y copiar su URL (`libsql://...`) y un token.
2. Crear un archivo `.env` (no se versiona):

   ```
   TURSO_DATABASE_URL=libsql://...
   TURSO_AUTH_TOKEN=...
   ```

3. Cargar la base: `npm run seed:prod`
4. Publicar la API: `npx vercel --prod`, definiendo las mismas dos variables en el proyecto de Vercel.
5. Poner la URL de la API en `API_PRODUCCION`, en `js/config.js`.
6. Mergear a `master`: GitHub Pages publica el frontend.

Variable opcional de la API: `CORS_ORIGIN`, con los dominios autorizados separados por coma (por defecto, `https://marcopalmiericirco.github.io`).

## Estructura

```
server.js            Entrada de la API en Vercel
server/app.js        App Express y rutas
server/auth.js       Sesiones y permisos por rol
server/schema.js     Modelo de datos
server/seed.js       Datos de demostración
server/routes/       Usuarios, clientes, oportunidades, actividades, configuración
server/test/         Pruebas de la API
js/forms.js          Formularios y flujo de cambio de etapa compartidos
js/pages/            Lógica de cada pantalla
*.html               Una página por pantalla
```
