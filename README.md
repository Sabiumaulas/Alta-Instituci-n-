# Sabium · Asistente de alta de instituciones

Reemplaza el Google Form de "Alta de Institución Piloto". Son dos piezas:

| Archivo | Qué es |
|---|---|
| `index.html` | El asistente web que completan los colegios. Es un único archivo, sin servidor propio. |
| `Code.gs` | El receptor en Google Apps Script: guarda cada alta en Drive y Sheets y avisa por mail. |

## Qué hace el asistente

- Tiene **9 pasos guiados**: institución, niveles y turnos, cursos y divisiones, horarios, materias, equipo, asignaciones, diseño curricular, y revisión y envío.
- **Guarda el avance solo** en el navegador. El colegio puede cerrar la página y seguir después.
- **Equipo:** el colegio pega el listado directamente desde Excel o Google Sheets. El asistente reconoce DNI, email y perfil, y detecta duplicados.
- **Horarios:** la grilla se genera automáticamente (inicio, duración, cantidad de módulos y recreos). También se puede copiar la grilla de un turno a otro.
- **Materias:** hay sugerencias por nivel y una matriz de módulos semanales por curso, con totales.
- **Asignaciones:** se indica qué docente da cada materia en cada división, con el botón "Igual en todas" para copiar una asignación a todas las divisiones.
- **Diseño curricular:** se suben los archivos, se avisa que se envían por mail o se pide ayuda.
- **Validaciones:** verifica el dígito verificador del CUIT, el formato de DNI y email, los módulos superpuestos y los campos obligatorios.
- **Varias personas:** con "Guardar avance (.json)" e "Importar avance" se pasan el trabajo entre ellas.
- **Descargar Excel** genera una planilla con una pestaña por tabla.

## Puesta en marcha (unos 15 minutos)

### 1. Publicar el receptor (Apps Script)
1. Entrá a https://script.google.com con la cuenta de Google de Sabium y creá un **Proyecto nuevo**.
2. Borrá el contenido, pegá todo `Code.gs` y guardá. Si querés, ajustá `CONFIG` (carpeta de Drive y mails).
3. Elegí la función `configurar` y tocá **Ejecutar**. Autorizá los permisos: Drive, Sheets y Gmail.
4. Abrí **Implementar → Nueva implementación → Tipo: Aplicación web**:
   - *Ejecutar como:* **Yo**
   - *Quién tiene acceso:* **Cualquier usuario**
5. Copiá la **URL de la aplicación web** (termina en `/exec`).

> Si después cambiás el código, usá **Implementar → Gestionar implementaciones → Editar → Nueva versión**. Así la URL se mantiene.

### 2. Conectar el asistente
En `index.html`, al principio del script, pegá la URL:

```js
const CONFIG = {
  endpoint: 'https://script.google.com/macros/s/XXXXXXXX/exec',
  ...
```

### 3. Publicar el asistente
Subí `index.html` a cualquier hosting estático, por ejemplo:
- **Tu web:** `www.sabium.com.ar/alta` (subilo como `alta/index.html`).
- **Netlify Drop** (https://app.netlify.com/drop): arrastrás la carpeta y listo.
- **GitHub Pages.**

Después mandale el enlace a cada colegio.

## Qué reciben ustedes en cada alta

- En Drive, una carpeta **"Nombre del colegio — fecha"** con:
  - la planilla con todas las pestañas,
  - el logo,
  - los archivos de diseño curricular,
  - `datos-alta.json`, con los datos completos para importar a Sabium.
- Una fila nueva en **"Sabium — Registro de altas"**, con el resumen y los enlaces.
- Un mail de aviso a `info@sabium.com.ar`. Si está activado, también un mail de confirmación a la persona de contacto del colegio.

## Notas

- **Datos personales:** el asistente recibe nombre, DNI y email del personal. Conviene sumar a la web de Sabium una política de privacidad que cubra este uso (Ley 25.326) y enlazarla desde el asistente.
- **Tamaño de los archivos:** el límite es de 10 MB por archivo (`CONFIG.maxFileMB`). Apps Script acepta envíos de hasta unos 50 MB en total.
- **Importación a Sabium:** `datos-alta.json` tiene una estructura fija (`datos` + `tablas`), así que se puede escribir un importador que cree niveles, cursos, usuarios y asignaciones directamente en la plataforma.
# Alta-Instituci-n-
