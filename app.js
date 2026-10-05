/* ===== FELORYX Hora-Sillón Calculator — App Logic ===== */
'use strict';

// --- DOM Elements ---
const form           = document.getElementById('calculatorForm');
const toggleBtn      = document.getElementById('toggleOptional');
const optionalFields = document.getElementById('optionalFields');
const globalError    = document.getElementById('globalError');
const resultsSection = document.getElementById('resultsSection');
const btnRecalculate = document.getElementById('btnRecalculate');
const pctInput       = document.getElementById('pctOcupacion');
const pctRange       = document.getElementById('pctOcupacionRange');

// --- Optional fields toggle ---
toggleBtn.addEventListener('click', () => {
  const isOpen = toggleBtn.getAttribute('aria-expanded') === 'true';
  toggleBtn.setAttribute('aria-expanded', String(!isOpen));
  optionalFields.hidden = isOpen;
  toggleBtn.querySelector('.toggle-icon').textContent = isOpen ? '+' : '×';
});

// --- Sync range ↔ number input ---
if (pctRange && pctInput) {
  pctRange.addEventListener('input', () => { pctInput.value = pctRange.value; });
  pctInput.addEventListener('input', () => {
    const v = parseInt(pctInput.value);
    if (!isNaN(v) && v >= 10 && v <= 100) pctRange.value = v;
  });
}

// --- Restore last values from localStorage ---
(function restoreState() {
  try {
    const saved = JSON.parse(localStorage.getItem('feloryx_hs_calc'));
    if (!saved) return;
    const fields = ['gastosFijos','diasTrabajados','horasDia','pctOcupacion','gastosVariables','margenObjetivo'];
    fields.forEach(id => {
      const el = document.getElementById(id);
      if (el && saved[id] !== undefined) el.value = saved[id];
    });
    if (saved.pctOcupacion && pctRange) pctRange.value = saved.pctOcupacion;
  } catch (e) { /* ignore */ }
})();

// --- Validation helpers ---
function clearErrors() {
  document.querySelectorAll('.field-error').forEach(el => { el.textContent = ''; });
  document.querySelectorAll('.input-wrapper').forEach(el => el.classList.remove('has-error'));
  globalError.hidden = true;
  globalError.textContent = '';
}

function setError(fieldId, message) {
  const errEl = document.getElementById('err-' + fieldId);
  if (errEl) errEl.textContent = message;
  const inputEl = document.getElementById(fieldId);
  if (inputEl) inputEl.closest('.input-wrapper')?.classList.add('has-error');
}

// --- Core calculation ---
function calcularHoraSillon(inputs) {
  const {
    gastosFijos,
    diasTrabajados,
    horasDia,
    pctOcupacion = 75,
    gastosVariables = 0,
    margenObjetivo = 30
  } = inputs;

  const horasDisponiblesMes = diasTrabajados * horasDia;
  const horasProductivas    = horasDisponiblesMes * (pctOcupacion / 100);

  if (horasProductivas === 0) {
    throw new Error('Con esos datos, las horas productivas son 0. Revisa el porcentaje de ocupación.');
  }

  const costoFijoPorHora    = gastosFijos / horasProductivas;
  const costoVariablePorHora = gastosVariables / horasProductivas;
  const costoHoraSillon     = costoFijoPorHora + costoVariablePorHora;
  const precioObjetivo      = costoHoraSillon * (1 + margenObjetivo / 100);

  if (costoHoraSillon > 5000) {
    throw new Error('El costo calculado parece muy alto. Verifica que los gastos estén en soles mensuales, no anuales.');
  }

  return {
    horasDisponiblesMes:    Math.round(horasDisponiblesMes * 10) / 10,
    horasProductivas:       Math.round(horasProductivas * 10) / 10,
    costoFijoPorHora:       Math.round(costoFijoPorHora * 100) / 100,
    costoVariablePorHora:   Math.round(costoVariablePorHora * 100) / 100,
    costoHoraSillon:        Math.round(costoHoraSillon * 100) / 100,
    precioObjetivo:         Math.round(precioObjetivo * 100) / 100,
    pctOcupacion,
    margenObjetivo,
    tieneVariables:         gastosVariables > 0
  };
}

// --- Validation ---
function validateInputs(data) {
  let valid = true;

  if (!data.gastosFijos || data.gastosFijos <= 0) {
    setError('gastosFijos', 'Introduce un valor mayor que 0.');
    valid = false;
  } else if (data.gastosFijos > 500000) {
    setError('gastosFijos', 'Valor muy alto. ¿Son gastos mensuales o anuales?');
    valid = false;
  }

  if (!data.diasTrabajados || data.diasTrabajados <= 0) {
    setError('diasTrabajados', 'Introduce los días trabajados al mes.');
    valid = false;
  } else if (data.diasTrabajados > 31) {
    setError('diasTrabajados', 'No puede superar 31 días al mes.');
    valid = false;
  }

  if (!data.horasDia || data.horasDia <= 0) {
    setError('horasDia', 'Introduce las horas disponibles por día.');
    valid = false;
  } else if (data.horasDia > 16) {
    setError('horasDia', 'Máximo 16 horas por día.');
    valid = false;
  }

  if (data.pctOcupacion < 10 || data.pctOcupacion > 100) {
    setError('pctOcupacion', 'El porcentaje debe estar entre 10% y 100%.');
    valid = false;
  }

  if (data.gastosVariables < 0) {
    setError('gastosVariables', 'No puede ser negativo.');
    valid = false;
  }

  if (data.margenObjetivo < 0 || data.margenObjetivo > 200) {
    setError('margenObjetivo', 'El margen debe estar entre 0% y 200%.');
    valid = false;
  }

  return valid;
}

// --- Formatting ---
function formatCurrency(value) {
  return new Intl.NumberFormat('es-PE', {
    style: 'currency',
    currency: 'PEN',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  }).format(value);
}

function formatHours(h) {
  return h.toLocaleString('es-PE', { maximumFractionDigits: 1 }) + ' h';
}

// --- Generate contextual insight ---
function generateInsight(res) {
  const c = res.costoHoraSillon;
  if (c < 80) {
    return `Tu costo de ${formatCurrency(c)}/h es bajo para el mercado peruano. Verifica que hayas incluido todos los gastos fijos — alquiler, sueldos, servicios, seguro y amortización de equipos.`;
  } else if (c < 180) {
    return `Tu costo de ${formatCurrency(c)}/h está en el rango habitual de consultorios pequeños en Perú. Con un ${res.pctOcupacion}% de ocupación, necesitas generar al menos ${formatCurrency(c)} por cada hora de sillón operativa solo para cubrir gastos fijos.`;
  } else if (c < 320) {
    return `Tu costo de ${formatCurrency(c)}/h indica una estructura de gastos media-alta. Muchos dentistas en clínicas urbanas de Lima o provincias cobran por debajo de este umbral sin saberlo — esta calculadora revela ese gap.`;
  } else {
    return `Tu costo de ${formatCurrency(c)}/h es elevado. Puede deberse a alquiler en zona premium, varios auxiliares o baja ocupación. Incluso reducir un 10% los gastos fijos o subir 5 puntos el porcentaje de ocupación puede bajar tu umbral significativamente.`;
  }
}

// --- Display results ---
function displayResults(res) {
  document.getElementById('resCostoHora').textContent      = formatCurrency(res.costoHoraSillon);
  document.getElementById('resPrecioObjetivo').textContent = formatCurrency(res.precioObjetivo);
  document.getElementById('resMargenLabel').textContent    = `(+${res.margenObjetivo}% margen)`;
  document.getElementById('resCostoContext').textContent   = `Con ${res.pctOcupacion}% de ocupación`;

  document.getElementById('detHorasDisp').textContent  = formatHours(res.horasDisponiblesMes);
  document.getElementById('detHorasProd').textContent  = formatHours(res.horasProductivas);
  document.getElementById('detCostoFijo').textContent  = formatCurrency(res.costoFijoPorHora) + '/h';
  document.getElementById('detCostoTotal').textContent = formatCurrency(res.costoHoraSillon) + '/h';

  const rowVar = document.getElementById('rowCostoVar');
  if (res.tieneVariables) {
    document.getElementById('detCostoVar').textContent = formatCurrency(res.costoVariablePorHora) + '/h';
    rowVar.hidden = false;
  } else {
    rowVar.hidden = true;
  }

  document.getElementById('insightText').textContent = generateInsight(res);

  // Show results, scroll to them
  resultsSection.hidden = false;
  resultsSection.scrollIntoView({ behavior: 'smooth', block: 'start' });
}

// --- Form submit ---
form.addEventListener('submit', (e) => {
  e.preventDefault();
  clearErrors();

  const rawData = {
    gastosFijos:     parseFloat(document.getElementById('gastosFijos').value)    || 0,
    diasTrabajados:  parseFloat(document.getElementById('diasTrabajados').value) || 0,
    horasDia:        parseFloat(document.getElementById('horasDia').value)       || 0,
    pctOcupacion:    parseFloat(pctInput?.value) || 75,
    gastosVariables: parseFloat(document.getElementById('gastosVariables').value) || 0,
    margenObjetivo:  parseFloat(document.getElementById('margenObjetivo').value) || 30
  };

  if (!validateInputs(rawData)) return;

  try {
    const results = calcularHoraSillon(rawData);
    displayResults(results);

    // Persist state
    try {
      localStorage.setItem('feloryx_hs_calc', JSON.stringify(rawData));
    } catch (e) { /* ignore */ }

  } catch (err) {
    globalError.textContent = err.message;
    globalError.hidden = false;
  }
});

// --- Recalculate button ---
btnRecalculate.addEventListener('click', () => {
  resultsSection.hidden = true;
  form.scrollIntoView({ behavior: 'smooth', block: 'start' });
});

// --- Export for testing (Node.js / test runner) ---
if (typeof module !== 'undefined' && module.exports) {
  module.exports = { calcularHoraSillon };
}
