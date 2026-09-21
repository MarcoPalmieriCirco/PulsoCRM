# Pulso CRM — Entrega 1

CRM especializado para cadenas de gimnasios y centros de entrenamiento. Sitio
estático (HTML + CSS + JavaScript, sin frameworks ni build step) con
persistencia en `localStorage`.

## Cómo correrlo localmente

Los módulos usan `localStorage`, que algunos navegadores restringen al abrir
un archivo directamente (`file://`). Lo más simple es levantar un servidor
estático desde esta carpeta:

```bash
python -m http.server 8420
```

y abrir `http://localhost:8420/index.html`.

(También funciona con `npx serve` o cualquier servidor estático equivalente.)

## Usuario de prueba

- Email: `cam@pulsocrm.com`
- Contraseña: `pulso123`

(También existe `julian@pulsocrm.com` / `pulso123`.)

## Qué incluye esta entrega

- **Acceso**: login funcional contra usuarios precargados.
- **Empresas y contactos**: alta, edición, listado, ficha de detalle y
  relación contacto–empresa.
- **Productos**: catálogo precargado (Pase Estándar, Atleta, Olímpico),
  de solo lectura.
- **Oportunidades**: alta, edición, relación con empresa o contacto,
  responsable asignado, producto, listado y detalle.
- **Embudo comercial**: tablero (drag & drop) y vista de lista, agrupadas
  por etapa, con filtros por responsable/etapa/estado/origen. Los cambios de
  etapa se guardan en `localStorage`.

Fuera de alcance en esta entrega (según `Entrega1.md`): gestión completa de
roles y permisos, actividades e historial comercial, historial de cambios de
etapa, configuraciones generales, cierre completo de oportunidades e
inteligencia artificial.

## Estructura

```
index.html              Login
inicio.html              Dashboard / resumen
oportunidades.html       Embudo comercial (tablero + lista)
oportunidad-detalle.html Detalle y cambio de etapa
clientes.html             Empresas y contactos (tabs)
empresa-detalle.html
contacto-detalle.html
productos.html
css/styles.css
js/constants.js          Datos precargados (etapas, productos, orígenes…)
js/db.js                 Persistencia en localStorage + datos semilla
js/auth.js                Login / logout / guard de sesión
js/ui.js                   Shell, modal, toast, formateadores
js/opportunities.js        Reglas de cambio de etapa
js/pages/*.js               Lógica de cada pantalla
```

## Reiniciar los datos de la demo

Los datos se precargan una sola vez. Para volver al estado inicial, borrar el
`localStorage` del sitio (DevTools → Application → Local Storage) o correr en
la consola del navegador:

```js
localStorage.clear();
location.reload();
```

## Despliegue

Al ser un sitio 100% estático, se puede desplegar arrastrando esta carpeta a
[Vercel](https://vercel.com) o [Netlify](https://netlify.com) (no requiere
build command ni variables de entorno).
