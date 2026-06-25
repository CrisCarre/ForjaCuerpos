// forja-kuerpo.js — cliente Supabase compartido + helpers
// ⚠️ Cambia estas dos líneas con tus datos de Supabase
const SUPABASE_URL      = 'https://TU_PROYECTO.supabase.co';
const SUPABASE_ANON_KEY = 'TU_ANON_KEY';

const GT = (() => {
  const sb = supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

  async function requireAuth() {
    const { data: { user } } = await sb.auth.getUser();
    if (!user) { window.location.href = './login.html'; return null; }
    return user;
  }

  async function requireGuest() {
    const { data: { user } } = await sb.auth.getUser();
    if (user) window.location.href = './index.html';
  }

  function formatRelativa(dateStr) {
    const d    = new Date(dateStr + 'T00:00:00');
    const hoy  = new Date(); hoy.setHours(0,0,0,0);
    const diff = Math.round((hoy - d) / 86400000);
    if (diff === 0) return 'Hoy';
    if (diff === 1) return 'Ayer';
    if (diff < 7)  return ['Dom','Lun','Mar','Mié','Jue','Vie','Sáb'][d.getDay()];
    return d.toLocaleDateString('es-ES', { day:'2-digit', month:'2-digit', year:'2-digit' });
  }

  function formatFechaLarga(dateStr) {
    const d    = new Date(dateStr + 'T00:00:00');
    const dias = ['Domingo','Lunes','Martes','Miércoles','Jueves','Viernes','Sábado'];
    const mes  = ['ene','feb','mar','abr','may','jun','jul','ago','sep','oct','nov','dic'];
    return `${dias[d.getDay()]}, ${d.getDate()} ${mes[d.getMonth()]} ${d.getFullYear()}`;
  }

  function getEmoji(nombre) {
    const n = (nombre || '').toLowerCase();
    if (n.includes('pecho') || n.includes('banca') || n.includes('tricep')) return '💪';
    if (n.includes('espalda') || n.includes('muerto') || n.includes('bicep')) return '🔗';
    if (n.includes('pierna') || n.includes('sentadilla') || n.includes('prensa')) return '🦵';
    if (n.includes('hombro')) return '🏋️';
    if (n.includes('cardio') || n.includes('hiit') || n.includes('corr')) return '🏃';
    if (n.includes('full') || n.includes('body')) return '⚡';
    return '🏋️';
  }

  function getBgColor(nombre) {
    const n = (nombre || '').toLowerCase();
    if (n.includes('pecho') || n.includes('tricep')) return '#EAF3DE';
    if (n.includes('espalda') || n.includes('bicep')) return '#FBEAF0';
    if (n.includes('pierna')) return '#E6F1FB';
    if (n.includes('hombro')) return '#FAEEDA';
    if (n.includes('cardio') || n.includes('hiit')) return '#FCEBEB';
    return '#F1EFE8';
  }

  function showToast(msg, tipo = 'ok') {
    const t = document.createElement('div');
    t.textContent = msg;
    t.style.cssText = `
      position:fixed;bottom:90px;left:50%;transform:translateX(-50%);
      background:${tipo === 'ok' ? '#3B6D11' : '#A32D2D'};color:white;
      padding:10px 20px;border-radius:20px;font-size:13px;z-index:999;
      box-shadow:0 2px 8px rgba(0,0,0,.2);animation:fadein .2s ease;
    `;
    document.body.appendChild(t);
    setTimeout(() => t.remove(), 2500);
  }

  // Calcular racha actual de días
  function calcRacha(fechas) {
    if (!fechas.length) return 0;
    const sorted = [...new Set(fechas)].sort().reverse();
    let racha = 0;
    let chk = new Date(); chk.setHours(0,0,0,0);
    for (const f of sorted) {
      const d = new Date(f + 'T00:00:00');
      if (d.getTime() === chk.getTime()) {
        racha++;
        chk.setDate(chk.getDate() - 1);
      } else break;
    }
    return racha;
  }

  // Agrupar entrenos por fecha relativa
  function agruparPorFecha(entrenos) {
    const grupos = {};
    for (const e of entrenos) {
      const d    = new Date(e.fecha + 'T00:00:00');
      const hoy  = new Date(); hoy.setHours(0,0,0,0);
      const diff = Math.round((hoy - d) / 86400000);
      let grupo;
      if (diff === 0)      grupo = 'Hoy';
      else if (diff === 1) grupo = 'Ayer';
      else if (diff <= 7)  grupo = 'Esta semana';
      else if (diff <= 30) grupo = 'Este mes';
      else                 grupo = 'Anteriores';
      if (!grupos[grupo]) grupos[grupo] = [];
      grupos[grupo].push(e);
    }
    return grupos;
  }

  // Exportar Excel con SheetJS (sin servidor)
  async function exportarExcel() {
    const { data: { user } } = await sb.auth.getUser();
    if (!user) return;

    showToast('Generando Excel...');

    const { data: entrenos, error } = await sb
      .from('entrenos')
      .select(`nombre, fecha, notas, ejercicios(nombre, categoria, orden, series(numero_serie, reps, peso_kg))`)
      .eq('usuario_id', user.id)
      .order('fecha', { ascending: false });

    if (error || !entrenos) { showToast('Error al exportar', 'error'); return; }

    // Hoja 1: todos los datos
    const filas1 = [['Fecha','Entreno','Ejercicio','Categoría','Serie','Reps','Peso (kg)','Notas']];
    for (const e of entrenos) {
      const ejs = [...(e.ejercicios||[])].sort((a,b) => a.orden - b.orden);
      for (const ej of ejs) {
        for (const s of (ej.series||[])) {
          filas1.push([e.fecha, e.nombre, ej.nombre, ej.categoria||'', s.numero_serie, s.reps||0, s.peso_kg||0, e.notas||'']);
        }
      }
    }

    // Hoja 2: resumen por ejercicio
    const ejMap = {};
    for (const e of entrenos) {
      for (const ej of (e.ejercicios||[])) {
        if (!ejMap[ej.nombre]) ejMap[ej.nombre] = { veces: 0, maxPeso: 0, totalReps: 0 };
        ejMap[ej.nombre].veces++;
        for (const s of (ej.series||[])) {
          if ((s.peso_kg||0) > ejMap[ej.nombre].maxPeso) ejMap[ej.nombre].maxPeso = s.peso_kg;
          ejMap[ej.nombre].totalReps += (s.reps||0);
        }
      }
    }
    const filas2 = [['Ejercicio','Máx. peso (kg)','Veces entrenado','Total reps']];
    Object.entries(ejMap)
      .sort((a,b) => b[1].maxPeso - a[1].maxPeso)
      .forEach(([nombre, d]) => filas2.push([nombre, d.maxPeso, d.veces, d.totalReps]));

    // Crear libro Excel
    const wb  = XLSX.utils.book_new();
    const ws1 = XLSX.utils.aoa_to_sheet(filas1);
    const ws2 = XLSX.utils.aoa_to_sheet(filas2);

    // Ancho de columnas automático
    ws1['!cols'] = [12,22,22,14,8,8,10,30].map(w => ({ wch: w }));
    ws2['!cols'] = [24,16,16,12].map(w => ({ wch: w }));

    XLSX.utils.book_append_sheet(wb, ws1, 'Entrenos');
    XLSX.utils.book_append_sheet(wb, ws2, 'Progreso');

    const fecha = new Date().toISOString().split('T')[0];
    XLSX.writeFile(wb, `forja-kuerpo_${fecha}.xlsx`);
    showToast('Excel descargado ✓');
  }

  return { sb, requireAuth, requireGuest, formatRelativa, formatFechaLarga, getEmoji, getBgColor, showToast, calcRacha, agruparPorFecha, exportarExcel };
})();

// Registro PWA Service Worker
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js').catch(() => {});
  });
}
