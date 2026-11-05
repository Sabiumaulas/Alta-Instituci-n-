/**
 * Sabium · Receptor de altas de instituciones
 * -------------------------------------------
 * Recibe los datos que envía el asistente web (index.html) y:
 *   1. Crea una carpeta por institución en Google Drive.
 *   2. Guarda el logo y los archivos de diseño curricular.
 *   3. Crea una planilla de Google Sheets con una pestaña por tabla
 *      (Institución, Niveles, Cursos y divisiones, Horarios, Materias,
 *      Equipo, Asignaciones, Diseño curricular).
 *   4. Agrega una fila al "Registro de altas" (planilla maestra).
 *   5. Avisa por mail al equipo de Sabium y (opcional) a la persona de contacto.
 *
 * Instalación: ver README.md
 */

const CONFIG = {
  // ID de una carpeta de Drive existente donde guardar todo. Vacío = se crea "Sabium — Altas de instituciones".
  CARPETA_RAIZ_ID: '',
  // A quién avisar cada vez que llega un alta.
  EMAIL_AVISO: 'info@sabium.com.ar',
  // Enviar un mail de confirmación a la persona de contacto de la institución.
  CONFIRMAR_A_CONTACTO: true,
  ZONA_HORARIA: 'America/Argentina/Buenos_Aires'
};

function doGet() {
  return json_({ ok: true, servicio: 'Sabium · alta de instituciones' });
}

function doPost(e) {
  const lock = LockService.getScriptLock();
  lock.waitLock(30000);
  try {
    const p = JSON.parse(e.postData.contents);
    if (p.formato !== 'sabium-alta' || !p.datos) throw new Error('Formato inválido');

    const d = p.datos;
    const inst = d.inst || {};
    const contacto = d.contacto || {};
    const nombre = (inst.nombre || 'Institución sin nombre').trim();
    const stamp = Utilities.formatDate(new Date(), CONFIG.ZONA_HORARIA, 'yyyy-MM-dd HH.mm');

    // 1. Carpeta de la institución
    const carpeta = carpetaRaiz_().createFolder(nombre + ' — ' + stamp);

    // 2. Archivos adjuntos
    const archivos = p.archivos || [];
    archivos.forEach(function (a) {
      const blob = Utilities.newBlob(
        Utilities.base64Decode(a.base64),
        a.tipo || 'application/octet-stream',
        (a.contexto ? a.contexto + ' - ' : '') + a.nombre
      );
      carpeta.createFile(blob);
    });

    // Copia completa de los datos (sin los archivos en base64) para re-importar o integrar
    const copia = Object.assign({}, p, {
      archivos: archivos.map(function (a) { return { id: a.id, nombre: a.nombre, tipo: a.tipo, contexto: a.contexto }; })
    });
    carpeta.createFile('datos-alta.json', JSON.stringify(copia, null, 2), MimeType.PLAIN_TEXT);

    // 3. Planilla de la institución
    const ss = SpreadsheetApp.create('Alta Sabium — ' + nombre);
    const tablas = p.tablas || {};
    let primera = true;
    Object.keys(tablas).forEach(function (titulo) {
      const filas = tablas[titulo] || [];
      if (!filas.length) return;
      const sh = primera ? ss.getSheets()[0].setName(titulo) : ss.insertSheet(titulo);
      primera = false;
      const ancho = Math.max.apply(null, filas.map(function (r) { return r.length; }));
      const datos = filas.map(function (r) {
        const x = r.map(function (v) { return v == null ? '' : v; });
        while (x.length < ancho) x.push('');
        return x;
      });
      const rango = sh.getRange(1, 1, datos.length, ancho);
      rango.setNumberFormat('@'); // texto: preserva DNI, CUIT y horarios tal cual
      rango.setValues(datos);
      sh.getRange(1, 1, 1, ancho).setFontWeight('bold').setBackground('#32375f').setFontColor('#ffffff');
      sh.setFrozenRows(1);
      sh.autoResizeColumns(1, ancho);
    });
    DriveApp.getFileById(ss.getId()).moveTo(carpeta);

    // 4. Registro maestro
    const cuenta = function (t) { return Math.max(0, ((tablas[t] || []).length) - 1); };
    const asign = (tablas['Asignaciones'] || []).slice(1);
    const asignadas = asign.filter(function (r) { return r[5] && r[5] !== 'Por definir'; }).length;
    registro_().appendRow([
      new Date(), nombre, inst.cuit || '', inst.localidad || '', inst.provincia || '',
      contacto.nombre || '', contacto.email || '', contacto.telefono || '',
      cuenta('Niveles'), cuenta('Cursos y divisiones'), cuenta('Equipo'),
      asign.length ? Math.round(asignadas * 100 / asign.length) + '%' : '-',
      archivos.length, ss.getUrl(), carpeta.getUrl()
    ]);

    // 5. Avisos
    if (CONFIG.EMAIL_AVISO) {
      MailApp.sendEmail({
        to: CONFIG.EMAIL_AVISO,
        subject: 'Nueva alta de institución: ' + nombre,
        htmlBody:
          '<p>Llegó un alta nueva desde el asistente.</p>' +
          '<p><b>' + esc_(nombre) + '</b><br>' + esc_(inst.localidad || '') + ', ' + esc_(inst.provincia || '') + '</p>' +
          '<p>Contacto: ' + esc_(contacto.nombre || '') + ' · ' + esc_(contacto.email || '') + ' · ' + esc_(contacto.telefono || '') + '</p>' +
          '<p>Cursos/divisiones: ' + cuenta('Cursos y divisiones') + ' · Personas: ' + cuenta('Equipo') + ' · Archivos: ' + archivos.length + '</p>' +
          '<p><a href="' + ss.getUrl() + '">Abrir planilla</a> · <a href="' + carpeta.getUrl() + '">Abrir carpeta</a></p>'
      });
    }
    if (CONFIG.CONFIRMAR_A_CONTACTO && contacto.email) {
      MailApp.sendEmail({
        to: contacto.email,
        replyTo: CONFIG.EMAIL_AVISO || undefined,
        name: 'Sabium',
        subject: 'Recibimos los datos de ' + nombre,
        htmlBody:
          '<p>¡Hola ' + esc_((contacto.nombre || '').split(' ')[0]) + '!</p>' +
          '<p>Recibimos los datos de <b>' + esc_(nombre) + '</b> para configurar Sabium. ' +
          'Nuestro equipo los va a revisar y en breve te contactamos para avanzar con la implementación.</p>' +
          '<p>Cualquier consulta, respondé este mail.</p><p>Equipo Sabium<br><i>Tus aulas, a un clic.</i></p>'
      });
    }

    return json_({ ok: true, id: ss.getId() });
  } catch (err) {
    return json_({ ok: false, error: String(err && err.message || err) });
  } finally {
    lock.releaseLock();
  }
}

/* ---------- helpers ---------- */
function json_(o) {
  return ContentService.createTextOutput(JSON.stringify(o)).setMimeType(ContentService.MimeType.JSON);
}
function esc_(s) {
  return String(s || '').replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; });
}
function carpetaRaiz_() {
  if (CONFIG.CARPETA_RAIZ_ID) return DriveApp.getFolderById(CONFIG.CARPETA_RAIZ_ID);
  const props = PropertiesService.getScriptProperties();
  const id = props.getProperty('CARPETA_RAIZ');
  if (id) { try { return DriveApp.getFolderById(id); } catch (e) {} }
  const f = DriveApp.createFolder('Sabium — Altas de instituciones');
  props.setProperty('CARPETA_RAIZ', f.getId());
  return f;
}
function registro_() {
  const props = PropertiesService.getScriptProperties();
  let id = props.getProperty('REGISTRO');
  let ss = null;
  if (id) { try { ss = SpreadsheetApp.openById(id); } catch (e) { ss = null; } }
  if (!ss) {
    ss = SpreadsheetApp.create('Sabium — Registro de altas');
    DriveApp.getFileById(ss.getId()).moveTo(carpetaRaiz_());
    const sh = ss.getSheets()[0].setName('Altas');
    const enc = ['Fecha', 'Institución', 'CUIT', 'Localidad', 'Provincia', 'Contacto', 'Email contacto', 'Teléfono contacto',
      'Niveles', 'Divisiones', 'Personas', 'Asignaciones', 'Archivos', 'Planilla', 'Carpeta'];
    sh.getRange(1, 1, 1, enc.length).setValues([enc]).setFontWeight('bold').setBackground('#32375f').setFontColor('#ffffff');
    sh.setFrozenRows(1);
    props.setProperty('REGISTRO', ss.getId());
  }
  return ss.getSheetByName('Altas') || ss.getSheets()[0];
}

/** Ejecutá esta función una vez desde el editor para autorizar permisos y crear la carpeta y el registro. */
function configurar() {
  carpetaRaiz_();
  registro_();
  Logger.log('Listo. Carpeta: ' + carpetaRaiz_().getUrl());
}
