
function copyRichText() {
    var el = document.getElementById('epr-output');
    if (!el) return;
    var htmlContent = el.innerHTML;
    var plainText = el.innerText;
    var copyBtn = document.getElementById('copy-rich-text-btn');
    function flashBtn(ok) {
        if (!copyBtn) return;
        var orig = copyBtn.textContent;
        copyBtn.textContent = ok ? '\u2713 Copied!' : 'Copy failed';
        copyBtn.style.background = ok ? '#16a34a' : '#dc2626';
        setTimeout(function() {
            copyBtn.textContent = orig;
            copyBtn.style.background = '';
        }, 1500);
    }
    if (navigator.clipboard && window.ClipboardItem) {
        navigator.clipboard.write([
            new ClipboardItem({
                'text/html':  new Blob([htmlContent], { type: 'text/html' }),
                'text/plain': new Blob([plainText],  { type: 'text/plain' })
            })
        ]).then(function() { flashBtn(true); })
          .catch(function() {
            navigator.clipboard.writeText(plainText)
                .then(function() { flashBtn(true); })
                .catch(function() { flashBtn(false); });
        });
    } else if (navigator.clipboard) {
        navigator.clipboard.writeText(plainText)
            .then(function() { flashBtn(true); })
            .catch(function() { flashBtn(false); });
    } else {
        try {
            var range = document.createRange();
            range.selectNodeContents(el);
            var sel = window.getSelection();
            sel.removeAllRanges();
            sel.addRange(range);
            document.execCommand('copy');
            sel.removeAllRanges();
            flashBtn(true);
        } catch(e) { flashBtn(false); }
    }
}

// ============================================================
// Wheeze Assessment — Children | script.js
// BTS/SIGN British Guideline on Asthma (2024) / NICE NG80
// Partners in Paediatrics 2025-28 — Asthma Acute Management pp.44-49
// ============================================================

const STORAGE_KEY = 'paed_wheeze_data';

let $ = null; // assigned in DOMContentLoaded
let form = null;

// ----------------------------------------------------------
// COPY RICH TEXT — exact required implementation
// ----------------------------------------------------------


// Panel button (id copy-rich-text-btn-panel) mirrors the same behaviour;
// wrap so both buttons flash on copy.
async function copyRichTextBoth() {
  const panelBtn = document.getElementById('copy-rich-text-btn-panel');
  await copyRichText();
  if (panelBtn) {
    const orig = 'Copy Rich Text';
    panelBtn.textContent = '✓ Copied!';
    panelBtn.classList.add('bg-green-600');
    setTimeout(() => {
      panelBtn.textContent = orig;
      panelBtn.classList.remove('bg-green-600');
    }, 1500);
  }
}

document.addEventListener('DOMContentLoaded', () => {
  $ = (id) => document.getElementById(id);
  form = $('wheeze-form');

  // Route panel button through the same copy logic
  const panelBtn = $('copy-rich-text-btn-panel');
  if (panelBtn) {
    panelBtn.onclick = copyRichTextBoth;
  }

  // ----------------------------------------------------------
  // FIELD REGISTRY
  // ----------------------------------------------------------
  function getAllFields() {
    return Array.from(form.querySelectorAll('input, textarea, select'));
  }

  function getCheckedValues(selector) {
    return Array.from(document.querySelectorAll(selector))
      .filter(cb => cb.checked)
      .map(cb => cb.value);
  }

  // ----------------------------------------------------------
  // SAVE / LOAD STATE (autosave to localStorage)
  // ----------------------------------------------------------
  let saveTimeout = null;

  function saveState() {
    const data = {};
    getAllFields().forEach(el => {
      if (el.type === 'checkbox') {
        if (!data.checkboxes) data.checkboxes = {};
        if (el.id) data.checkboxes[el.id] = el.checked;
      } else if (el.type === 'radio') {
        if (el.checked) {
          if (!data.radios) data.radios = {};
          data.radios[el.name] = el.value;
        }
      } else {
        if (el.id) data[el.id] = el.value;
      }
    });
    data.multi = {
      triggers: getCheckedValues('.trigger-cb'),
      othersym: getCheckedValues('.othersym-cb'),
      sev: getCheckedValues('.sev-cb'),
      dc: getCheckedValues('.dc-cb'),
      dm: getCheckedValues('.dm-cb'),
      monitor: getCheckedValues('.monitor-cb')
    };
    data.manualFlags = {};
    ['salb-dose', 'ipra-dose', 'steroid-dose', 'mgso4-dose', 'secondline-dose', 'secondline-infusion'].forEach(id => {
      const el = $(id);
      if (el && el.dataset.manual === 'true') data.manualFlags[id] = true;
    });
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
      flashAutosave();
    } catch (e) { /* ignore storage errors */ }
  }

  function flashAutosave() {
    const ind = $('autosave-indicator');
    if (!ind) return;
    ind.classList.remove('hidden');
    ind.classList.add('flex');
  }

  function loadState() {
    let raw;
    try { raw = localStorage.getItem(STORAGE_KEY); } catch (e) { raw = null; }
    if (!raw) return;
    let data;
    try { data = JSON.parse(raw); } catch (e) { return; }

    getAllFields().forEach(el => {
      if (el.type === 'checkbox') {
        if (el.id && data.checkboxes && el.id in data.checkboxes) {
          el.checked = data.checkboxes[el.id];
        }
      } else if (el.type === 'radio') {
        if (data.radios && data.radios[el.name] === el.value) {
          el.checked = true;
        }
      } else {
        if (el.id && data[el.id] !== undefined) {
          el.value = data[el.id];
        }
      }
    });

    if (data.multi) {
      restoreMultiCheckbox('.trigger-cb', data.multi.triggers);
      restoreMultiCheckbox('.othersym-cb', data.multi.othersym);
      restoreMultiCheckbox('.sev-cb', data.multi.sev);
      restoreMultiCheckbox('.dc-cb', data.multi.dc);
      restoreMultiCheckbox('.dm-cb', data.multi.dm);
      restoreMultiCheckbox('.monitor-cb', data.multi.monitor);
    }

    if (data.manualFlags) {
      Object.keys(data.manualFlags).forEach(id => {
        const el = $(id);
        if (el) el.dataset.manual = 'true';
      });
    }

    toggleAsthmaticDetails();
    togglePrevVisitsCount();
    toggleRelieverDoses();
    toggleTriggerOther();
    toggleDifferentialOther();
    $('prev-itu-alert').classList.toggle('hidden', !$('prev-itu-yes').checked);
    calculateAge();
    runAllCalculationsAndNotes();
  }

  function restoreMultiCheckbox(selector, values) {
    if (!values) return;
    document.querySelectorAll(selector).forEach(cb => {
      cb.checked = values.includes(cb.value);
    });
  }

  // ----------------------------------------------------------
  // AGE CALCULATION
  // ----------------------------------------------------------
  function calculateAge() {
    const dobVal = $('pt-dob').value;
    if (!dobVal) { $('pt-age').value = ''; return; }
    const dob = new Date(dobVal);
    const now = new Date();
    if (isNaN(dob.getTime()) || dob > now) { $('pt-age').value = ''; return; }

    let years = now.getFullYear() - dob.getFullYear();
    let months = now.getMonth() - dob.getMonth();
    if (now.getDate() < dob.getDate()) months--;
    if (months < 0) { years--; months += 12; }

    if (years < 1) {
      let totalMonths = (now.getFullYear() - dob.getFullYear()) * 12 + (now.getMonth() - dob.getMonth());
      if (now.getDate() < dob.getDate()) totalMonths--;
      $('pt-age').value = `${Math.max(totalMonths, 0)} month(s)`;
    } else {
      $('pt-age').value = `${years}y ${months}m`;
    }
  }

  function getAgeYearsNumeric() {
    const dobVal = $('pt-dob').value;
    if (!dobVal) return null;
    const dob = new Date(dobVal);
    const now = new Date();
    if (isNaN(dob.getTime())) return null;
    return (now - dob) / (1000 * 60 * 60 * 24 * 365.25);
  }

  // ----------------------------------------------------------
  // CONDITIONAL UI TOGGLES
  // ----------------------------------------------------------
  function toggleAsthmaticDetails() {
    const yes = document.querySelector('input[name="known-asthmatic"][value="Yes"]').checked;
    $('asthmatic-details').classList.toggle('hidden', !yes);
  }
  document.getElementsByName('known-asthmatic').forEach(r =>
    r.addEventListener('change', () => { toggleAsthmaticDetails(); updateNotes(); })
  );

  function toggleTriggerOther() {
    const checked = $('trigger-other-cb').checked;
    $('trigger-other-text').classList.toggle('hidden', !checked);
  }
  $('trigger-other-cb').addEventListener('change', () => { toggleTriggerOther(); updateNotes(); });

  function togglePrevVisitsCount() {
    const yes = document.querySelector('input[name="prev-visits"][value="Yes"]')?.checked;
    $('prev-visits-count-wrap').classList.toggle('hidden', !yes);
  }
  document.getElementsByName('prev-visits').forEach(r =>
    r.addEventListener('change', () => { togglePrevVisitsCount(); updateNotes(); })
  );

  function toggleRelieverDoses() {
    const yes = document.querySelector('input[name="reliever-prior"][value="Yes"]')?.checked;
    $('reliever-doses-wrap').classList.toggle('hidden', !yes);
  }
  document.getElementsByName('reliever-prior').forEach(r =>
    r.addEventListener('change', () => { toggleRelieverDoses(); updateNotes(); })
  );

  function toggleDifferentialOther() {
    const checked = $('differential-other-cb').checked;
    $('differential-other-text').classList.toggle('hidden', !checked);
  }
  $('differential-other-cb').addEventListener('change', () => { toggleDifferentialOther(); updateNotes(); });

  // RED FLAG: previous ITU admission
  document.getElementsByName('prev-itu').forEach(r =>
    r.addEventListener('change', () => {
      $('prev-itu-alert').classList.toggle('hidden', !$('prev-itu-yes').checked);
      updateNotes();
    })
  );

  // ----------------------------------------------------------
  // SEVERITY ENGINE (Section 3) — Partners in Paediatrics 2025-28
  // Levels: mildmod < severe < lifethreat
  // ----------------------------------------------------------
  const SEVERITY_ORDER = ['mildmod', 'severe', 'lifethreat'];
  const SEVERITY_LABEL = {
    mildmod: 'MILD / MODERATE',
    severe: 'SEVERE',
    lifethreat: 'LIFE-THREATENING'
  };
  const SEVERITY_STYLE = {
    mildmod: { bg: 'bg-green-50', border: 'border-green-500', text: 'text-green-700' },
    severe: { bg: 'bg-orange-50', border: 'border-orange-600', text: 'text-orange-800' },
    lifethreat: { bg: 'bg-red-50', border: 'border-red-600', text: 'text-red-700' }
  };

  function calculateSeverity() {
    let worst = null;
    document.querySelectorAll('.sev-cb').forEach(cb => {
      if (cb.checked) {
        const level = cb.dataset.level;
        if (worst === null || SEVERITY_ORDER.indexOf(level) > SEVERITY_ORDER.indexOf(worst)) {
          worst = level;
        }
      }
    });
    return worst;
  }

  function updateSeverityBanner() {
    const worst = calculateSeverity();
    const bannerMain = $('severity-banner');
    const bannerText = $('severity-banner-text');
    const bannerTreat = $('treatment-severity-banner');
    const bannerTreatText = $('treatment-severity-text');

    [[bannerMain, bannerText, false], [bannerTreat, bannerTreatText, true]].forEach(([banner, text, isTreat]) => {
      banner.className = 'rounded-lg border-2 text-center' + (isTreat ? ' p-3' : ' p-4');
      text.className = isTreat ? 'text-xl font-black' : 'text-2xl font-black';

      if (!worst) {
        banner.classList.add('bg-slate-50', 'border-slate-300');
        text.classList.add('text-slate-400');
        text.textContent = 'NOT YET ASSESSED';
      } else {
        const s = SEVERITY_STYLE[worst];
        banner.classList.add(s.bg, s.border);
        text.classList.add(s.text);
        text.textContent = SEVERITY_LABEL[worst];
      }
    });

    const admissionFlag = $('admission-autoflag');
    if (worst === 'severe' || worst === 'lifethreat') {
      admissionFlag.classList.remove('hidden');
    } else {
      admissionFlag.classList.add('hidden');
    }

    return worst;
  }

  document.querySelectorAll('.sev-cb').forEach(cb => cb.addEventListener('change', () => { updateSeverityBanner(); updateNotes(); }));

  // ----------------------------------------------------------
  // EXAMINATION AUTO-FLAGS
  // ----------------------------------------------------------
  function updateSpo2Flag() {
    const val = parseFloat($('ex-spo2').value);
    const flag = $('spo2-flag');
    flag.textContent = '';
    flag.className = 'text-xs font-bold mt-1';
    if (isNaN(val)) return;
    if (val < 92) {
      flag.textContent = '⚠ <92% — SEVERE/LIFE-THREATENING RANGE';
      flag.classList.add('flag-red');
    } else if (val < 94) {
      flag.textContent = '⚠ <94% — below discharge threshold';
      flag.classList.add('flag-amber');
    }
  }
  $('ex-spo2').addEventListener('input', () => { updateSpo2Flag(); updateNotes(); });

  function updatePefrFlag() {
    const val = parseFloat($('ex-pefr').value);
    const flag = $('pefr-flag');
    flag.textContent = '';
    flag.className = 'text-xs font-bold mt-1';
    if (isNaN(val)) return;
    if (val <= 30) {
      flag.textContent = '⚠ ≤30% predicted/best — LIFE-THREATENING';
      flag.classList.add('flag-red');
    } else if (val < 50) {
      flag.textContent = '⚠ 30-50% predicted/best — SEVERE';
      flag.classList.add('flag-amber');
    }
  }
  $('ex-pefr').addEventListener('input', () => { updatePefrFlag(); updateNotes(); });

  // Age-adjusted RR/HR notes — Partners in Paediatrics bands
  function getAgeBandThresholds(ageYrs) {
    // Returns { rr, hr } "severe" thresholds and discharge thresholds by band
    if (ageYrs === null) return null;
    if (ageYrs < 5) return { band: '<5yr', rrSevere: 40, hrSevere: 140, rrDischarge: 40, hrDischarge: 140 };
    if (ageYrs < 12) return { band: '5-11yr', rrSevere: 30, hrSevere: 125, rrDischarge: 30, hrDischarge: 125 };
    return { band: '12-18yr', rrSevere: 25, hrSevere: 110, rrDischarge: 25, hrDischarge: 110 };
  }

  function updateAgeAdjustedNotes() {
    const ageYrs = getAgeYearsNumeric();
    $('rr-note').textContent = 'Norms: <5yr <40, 5-11yr <30, 12-18yr <25';
    $('hr-note').textContent = 'Norms: <5yr <140, 5-11yr <125, 12-18yr <110';

    const bands = getAgeBandThresholds(ageYrs);
    if (bands) {
      const rr = parseFloat($('ex-rr').value);
      const hr = parseFloat($('ex-hr').value);
      if (!isNaN(rr) && rr > bands.rrSevere) {
        $('rr-note').innerHTML = `<span class="flag-amber">⚠ Tachypnoeic for age (${bands.band} threshold ${bands.rrSevere})</span>`;
      }
      if (!isNaN(hr) && hr > bands.hrSevere) {
        $('hr-note').innerHTML = `<span class="flag-amber">⚠ Tachycardic for age (${bands.band} threshold ${bands.hrSevere})</span>`;
      }
    }
  }
  $('ex-rr').addEventListener('input', () => { updateAgeAdjustedNotes(); updateNotes(); });
  $('ex-hr').addEventListener('input', () => { updateAgeAdjustedNotes(); updateNotes(); });
  $('pt-dob').addEventListener('change', () => { calculateAge(); updateAgeAdjustedNotes(); updateDoseCalculations(); updateNotes(); });

  document.getElementsByName('ausc-silent').forEach(r => r.addEventListener('change', updateNotes));
  $('ex-cyanosis').addEventListener('change', updateNotes);

  // ----------------------------------------------------------
  // DOSE CALCULATIONS (Section 6) — Partners in Paediatrics 2025-28
  // ----------------------------------------------------------
  function getWeight() {
    const w = parseFloat($('pt-weight').value);
    return isNaN(w) ? null : w;
  }
  function getAgeYearsForDosing() {
    return getAgeYearsNumeric();
  }

  // Round up to nearest 5mg
  function roundUpTo5(mg) {
    return Math.ceil(mg / 5) * 5;
  }

  function updateSalbDose() {
    const route = document.querySelector('input[name="salb-route"]:checked')?.value;
    const ageYrs = getAgeYearsForDosing();
    const field = $('salb-dose');
    if (field.dataset.manual === 'true') return;
    if (!route) return;
    if (route === 'Nebulised') {
      if (ageYrs !== null) {
        if (ageYrs < 5) field.value = '2.5mg nebulised (<5yr)';
        else if (ageYrs < 12) field.value = '2.5–5mg nebulised (5-11yr)';
        else field.value = '5mg nebulised (≥12yr)';
      } else {
        field.value = '<5yr 2.5mg | 5-11yr 2.5-5mg | ≥12yr 5mg nebulised';
      }
    } else if (route === 'Spacer+MDI') {
      field.value = '2–10 puffs via spacer';
    } else if (route === 'IV') {
      field.value = 'See second-line IV salbutamol bolus below';
    }
  }
  document.getElementsByName('salb-route').forEach(r => r.addEventListener('change', () => { updateSalbDose(); updateNotes(); }));
  $('salb-dose').addEventListener('input', () => { $('salb-dose').dataset.manual = 'true'; updateNotes(); });

  function updateIpraDose() {
    const field = $('ipra-dose');
    if (field.dataset.manual === 'true') return;
    const ageYrs = getAgeYearsForDosing();
    if (ageYrs !== null) {
      field.value = ageYrs < 12
        ? '250mcg nebulised (<12yr, max 1mg/day)'
        : '500mcg nebulised (≥12yr, max 2mg/day)';
    } else {
      field.value = '250mcg (<12yr, max 1mg/day) / 500mcg (≥12yr, max 2mg/day)';
    }
  }
  document.getElementsByName('ipra-given').forEach(r => r.addEventListener('change', () => { updateIpraDose(); updateNotes(); }));
  $('ipra-dose').addEventListener('input', () => { $('ipra-dose').dataset.manual = 'true'; updateNotes(); });

  function updateSteroidDose() {
    const field = $('steroid-dose');
    if (field.dataset.manual === 'true') return;
    const drug = $('steroid-drug').value;
    const w = getWeight();
    const ageYrs = getAgeYearsForDosing();
    const onMaintenance = $('steroid-maintenance').checked;
    if (!drug) return;

    if (drug === 'Prednisolone') {
      if (onMaintenance) {
        if (w !== null) {
          let low = roundUpTo5(w * 1);
          let high = Math.min(roundUpTo5(w * 2), 60);
          field.value = `${low}–${high}mg (1-2mg/kg, max 60mg) — discuss weaning with respiratory consultant`;
        } else {
          field.value = '1-2mg/kg (max 60mg) — discuss weaning with respiratory consultant';
        }
      } else if (w !== null) {
        let doseMg = roundUpTo5(w * 1);
        let maxByAge = null;
        let ageLabel = '';
        if (ageYrs !== null) {
          if (ageYrs < 2) { maxByAge = 10; ageLabel = '<2yr'; }
          else if (ageYrs < 5) { maxByAge = 20; ageLabel = '2-5yr'; }
          else if (ageYrs < 12) { maxByAge = 30; ageLabel = '>5yr'; }
          else { maxByAge = 40; ageLabel = '≥12yr'; }
        }
        let finalDose = maxByAge !== null ? Math.min(doseMg, maxByAge) : doseMg;
        let cappedNote = (maxByAge !== null && doseMg > maxByAge) ? ` (capped, max ${maxByAge}mg ${ageLabel})` : '';
        field.value = `${finalDose}mg OD (1mg/kg, rounded up to nearest 5mg)${cappedNote}`;
      } else {
        field.value = '1mg/kg OD (round up to nearest 5mg): <2yr max 10mg, 2-5yr max 20mg, >5yr max 30mg, ≥12yr max 40mg';
      }
    } else if (drug === 'Hydrocortisone') {
      if (w !== null) {
        let doseMg = Math.min(w * 4, 100);
        let cappedNote = (w * 4) > 100 ? ' (capped at max 100mg/dose)' : '';
        field.value = `${doseMg.toFixed(0)}mg IV 6-hrly (4mg/kg${cappedNote})`;
      } else if (ageYrs !== null) {
        let byAgeDose;
        if (ageYrs < 1) byAgeDose = '25mg';
        else if (ageYrs < 5) byAgeDose = '50mg';
        else byAgeDose = '100mg';
        field.value = `${byAgeDose} IV 6-hrly (by age band)`;
      } else {
        field.value = '4mg/kg IV 6-hrly (max 100mg/dose) or by age: 1mo-1yr 25mg, 2-4yr 50mg, 5-18yr 100mg, 6-hrly';
      }
    } else if (drug === 'Dexamethasone') {
      if (w !== null) {
        field.value = `${(w * 0.15).toFixed(2)}mg (0.15mg/kg)`;
      } else {
        field.value = '0.15mg/kg';
      }
    }
  }
  $('steroid-drug').addEventListener('change', () => { updateSteroidDose(); updateNotes(); });
  $('steroid-maintenance').addEventListener('change', () => { updateSteroidDose(); updateNotes(); });
  $('steroid-dose').addEventListener('input', () => { $('steroid-dose').dataset.manual = 'true'; updateNotes(); });
  document.getElementsByName('steroid-given').forEach(r => r.addEventListener('change', updateNotes));
  document.getElementsByName('steroid-route').forEach(r => r.addEventListener('change', updateNotes));

  function updateMgso4Dose() {
    const field = $('mgso4-dose');
    if (field.dataset.manual === 'true') return;
    const w = getWeight();
    const route = document.querySelector('input[name="mgso4-route"]:checked')?.value;
    if (route === 'Nebulised') {
      field.value = 'Nebulised magnesium sulfate per local protocol';
      return;
    }
    if (w !== null) {
      let doseMg = w * 40;
      let capped = doseMg > 2000;
      let finalDose = capped ? 2000 : doseMg;
      field.value = `${finalDose.toFixed(0)}mg IV over 20 min (40mg/kg${capped ? ', capped at max 2g' : ''}) — dilute 50% inj. to 10% with 4x vol NaCl 0.9%`;
    } else {
      field.value = '40mg/kg IV over 20 min (max 2g) — dilute 50% inj. to 10% with 4x vol NaCl 0.9%';
    }
  }
  document.getElementsByName('mgso4-given').forEach(r => r.addEventListener('change', () => { updateMgso4Dose(); updateNotes(); }));
  document.getElementsByName('mgso4-route').forEach(r => r.addEventListener('change', () => { updateMgso4Dose(); updateNotes(); }));
  $('mgso4-dose').addEventListener('input', () => { $('mgso4-dose').dataset.manual = 'true'; updateNotes(); });
  $('mgso4-not-responding').addEventListener('change', updateNotes);

  // Second-line IV: salbutamol bolus / aminophylline
  function updateSecondLineDose() {
    const agent = document.querySelector('input[name="secondline-agent"]:checked')?.value;
    const w = getWeight();
    const ageYrs = getAgeYearsForDosing();
    const doseField = $('secondline-dose');
    const infField = $('secondline-infusion');
    const onTheophylline = $('secondline-on-theophylline').checked;

    if (!agent) return;

    if (agent === 'IV Salbutamol bolus') {
      if (doseField.dataset.manual !== 'true') {
        if (w !== null && ageYrs !== null) {
          let mcgPerKg = ageYrs < 2 ? 5 : 15;
          let maxMcg = 250;
          let doseMcg = Math.min(w * mcgPerKg, maxMcg);
          doseField.value = `${doseMcg.toFixed(0)}mcg IV bolus over 5 min (${mcgPerKg}mcg/kg, max 250mcg)`;
        } else {
          doseField.value = '<2yr 5mcg/kg (max 250mcg) | ≥2yr 15mcg/kg (max 250mcg), IV bolus over 5 min';
        }
      }
      if (infField.dataset.manual !== 'true') infField.value = 'N/A (bolus only)';
    } else if (agent === 'IV Aminophylline') {
      if (doseField.dataset.manual !== 'true') {
        if (onTheophylline) {
          doseField.value = '⚠ DO NOT GIVE loading dose — patient already on theophylline. Discuss with consultant.';
        } else if (w !== null) {
          let loadDose = Math.min(w * 5, 500);
          let cappedNote = (w * 5) > 500 ? ' (capped at max 500mg)' : '';
          doseField.value = `${loadDose.toFixed(0)}mg IV loading dose (5mg/kg${cappedNote})`;
        } else {
          doseField.value = '5mg/kg IV loading dose (max 500mg) — do NOT give if already on theophylline';
        }
      }
      if (infField.dataset.manual !== 'true') {
        if (w !== null && ageYrs !== null) {
          if (ageYrs < 12) {
            infField.value = `${(w * 1).toFixed(1)}mg/hr maintenance infusion (1mg/kg/hr, 1mo-11yr)`;
          } else {
            let low = (w * 0.5).toFixed(1);
            let high = (w * 0.7).toFixed(1);
            infField.value = `${low}–${high}mg/hr maintenance infusion (500-700mcg/kg/hr, 12-17yr)`;
          }
        } else {
          infField.value = '1mo-11yr: 1mg/kg/hr | 12-17yr: 500-700mcg/kg/hr maintenance infusion';
        }
      }
    }
  }
  document.getElementsByName('secondline-given').forEach(r => r.addEventListener('change', updateNotes));
  document.getElementsByName('secondline-agent').forEach(r => r.addEventListener('change', () => { updateSecondLineDose(); updateNotes(); }));
  $('secondline-on-theophylline').addEventListener('change', () => { updateSecondLineDose(); updateNotes(); });
  $('secondline-dose').addEventListener('input', () => { $('secondline-dose').dataset.manual = 'true'; updateNotes(); });
  $('secondline-infusion').addEventListener('input', () => { $('secondline-infusion').dataset.manual = 'true'; updateNotes(); });

  $('pt-weight').addEventListener('input', updateDoseCalculations);

  function updateDoseCalculations() {
    updateSalbDose();
    updateIpraDose();
    updateSteroidDose();
    updateMgso4Dose();
    updateSecondLineDose();
  }

  // ----------------------------------------------------------
  // EPR NOTE GENERATION
  // ----------------------------------------------------------
  function esc(str) {
    if (!str) return '';
    const div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
  }

  function radioVal(name) {
    const el = document.querySelector(`input[name="${name}"]:checked`);
    return el ? el.value : '';
  }

  function generateEPRNote() {
    const today = new Date();
    const dateStr = today.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
    const timeStr = today.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' });

    let lines = [];
    lines.push(`<b>PAEDIATRIC WHEEZE ASSESSMENT — ${dateStr} ${timeStr}</b>`);
    lines.push('');

    // Patient details
    lines.push('<b>PATIENT DETAILS</b>');
    const name = $('pt-name').value || '—';
    const dob = $('pt-dob').value || '—';
    const age = $('pt-age').value || '—';
    const weight = $('pt-weight').value ? `${$('pt-weight').value} kg` : '—';
    const gender = $('pt-gender').value || '—';
    const allergy = $('pt-allergy').value || 'Not documented';
    lines.push(`Name: ${esc(name)} | DOB: ${esc(dob)} | Age: ${esc(age)} | Weight: ${esc(weight)} | Gender: ${esc(gender)}`);
    lines.push(`Allergy status: ${esc(allergy)}`);

    const knownAsthmatic = radioVal('known-asthmatic');
    if (knownAsthmatic === 'Yes') {
      const yrs = $('asthma-years').value || '—';
      const prev = $('usual-preventer').value || '—';
      const rel = $('usual-reliever').value || '—';
      lines.push(`Known asthmatic: Yes (${esc(yrs)}) | Preventer: ${esc(prev)} | Reliever: ${esc(rel)}`);
    } else {
      lines.push('Known asthmatic: No');
    }

    const meds = $('current-meds').value;
    if (meds) lines.push(`Current medications: ${esc(meds)}`);
    const pc = $('presenting-complaint').value;
    if (pc) lines.push(`Presenting complaint: ${esc(pc)}`);
    lines.push('');

    // History
    lines.push('<b>HISTORY</b>');
    const durationSx = $('duration-symptoms').value || '—';
    const onset = $('time-onset').value || '—';
    const urti = radioVal('preceding-urti') || '—';
    lines.push(`Duration of symptoms: ${esc(durationSx)} | Onset: ${esc(onset)} | Preceding URTI: ${esc(urti)}`);

    const triggers = getCheckedValues('.trigger-cb');
    let triggerLine = triggers.length ? triggers.join(', ') : 'None documented';
    if (triggers.includes('Other') && $('trigger-other-text').value) {
      triggerLine = triggerLine.replace('Other', `Other (${$('trigger-other-text').value})`);
    }
    lines.push(`Trigger(s): ${esc(triggerLine)}`);

    const prevVisits = radioVal('prev-visits');
    let prevVisitsLine = prevVisits === 'Yes'
      ? `Yes (${$('prev-visits-count').value || '?'} in last 12 months)`
      : (prevVisits === 'No' ? 'No' : '—');
    lines.push(`Previous A&E/hospital visits for wheeze: ${esc(prevVisitsLine)}`);

    const prevItu = radioVal('prev-itu');
    lines.push(`Previous ITU admission/ventilation: ${prevItu === 'Yes' ? '<b>YES — RED FLAG</b>' : (prevItu || '—')}`);

    const relieverPrior = radioVal('reliever-prior');
    let relieverLine = relieverPrior === 'Yes'
      ? `Yes (${$('reliever-doses').value || '?'} doses in last hour)`
      : (relieverPrior === 'No' ? 'No' : '—');
    lines.push(`Reliever used prior to attendance: ${esc(relieverLine)}`);

    const adherence = radioVal('preventer-adherence') || '—';
    lines.push(`Preventer adherence: ${esc(adherence)}`);

    const smoking = radioVal('household-smoking') || '—';
    lines.push(`Smoking in household: ${esc(smoking)}`);

    const otherSym = getCheckedValues('.othersym-cb');
    lines.push(`Other symptoms: ${otherSym.length ? esc(otherSym.join(', ')) : 'None'}`);
    lines.push('');

    // Severity
    const worstSeverity = calculateSeverity();
    lines.push('<b>SEVERITY</b> (Partners in Paediatrics 2025-28)');
    if (worstSeverity) {
      lines.push(`<b>SEVERITY: ${SEVERITY_LABEL[worstSeverity]}</b>`);
      const checkedCriteria = Array.from(document.querySelectorAll('.sev-cb'))
        .filter(cb => cb.checked)
        .map(cb => cb.value);
      if (checkedCriteria.length) {
        lines.push(`Criteria met: ${esc(checkedCriteria.join('; '))}`);
      }
    } else {
      lines.push('<b>SEVERITY: NOT YET ASSESSED</b>');
    }
    lines.push('');

    // Examination
    lines.push('<b>EXAMINATION</b>');
    const spo2 = $('ex-spo2').value ? `${$('ex-spo2').value}%` : '—';
    const rr = $('ex-rr').value || '—';
    const hr = $('ex-hr').value || '—';
    const temp = $('ex-temp').value ? `${$('ex-temp').value}°C` : '—';
    const pefr = $('ex-pefr').value ? `${$('ex-pefr').value}%` : 'not able';
    lines.push(`SpO2: ${esc(spo2)} | RR: ${esc(rr)} | HR: ${esc(hr)} | Temp: ${esc(temp)} | PEFR: ${esc(pefr)}`);

    const wheeze = radioVal('ausc-wheeze') || '—';
    const rae = radioVal('ausc-rae') || '—';
    const crackles = radioVal('ausc-crackles') || '—';
    const silent = radioVal('ausc-silent');
    lines.push(`Auscultation: Wheeze — ${esc(wheeze)}; Reduced air entry — ${esc(rae)}; Crackles — ${esc(crackles)}; Silent chest — ${silent === 'Yes' ? '<b>YES</b>' : (silent || '—')}`);

    const wob = radioVal('work-breathing') || '—';
    lines.push(`Work of breathing: ${esc(wob)}`);

    const signs = [];
    if ($('ex-subcostal').checked) signs.push('Subcostal recession');
    if ($('ex-intercostal').checked) signs.push('Intercostal recession');
    if ($('ex-trachealtug').checked) signs.push('Tracheal tug');
    if ($('ex-nasalflare').checked) signs.push('Nasal flaring / flaring alae nasi');
    if ($('ex-headbob').checked) signs.push('Head bobbing');
    if ($('ex-accessory').checked) signs.push('Accessory muscle use');
    if ($('ex-cyanosis').checked) signs.push('CYANOSIS');
    lines.push(`Signs of respiratory distress: ${signs.length ? esc(signs.join(', ')) : 'None documented'}`);
    lines.push('');

    // Differential
    lines.push('<b>DIFFERENTIAL DIAGNOSIS</b>');
    let differential = radioVal('differential');
    if (differential === 'Other' && $('differential-other-text').value) {
      differential = `Other — ${$('differential-other-text').value}`;
    }
    lines.push(`Most likely: ${esc(differential || 'Not yet determined')}`);
    const diffNotes = $('differential-notes').value;
    if (diffNotes) lines.push(`Notes: ${esc(diffNotes)}`);
    lines.push('');

    // Treatment
    lines.push('<b>TREATMENT GIVEN</b>');
    const salbRoute = radioVal('salb-route');
    if (salbRoute) {
      const salbDose = $('salb-dose').value || '—';
      const salbTime = $('salb-time').value || '—';
      const salbResp = radioVal('salb-response') || '—';
      const salbRepeat = $('salb-repeat').value || '0';
      const salbFreq = radioVal('salb-freq') || '—';
      lines.push(`Salbutamol: ${esc(salbRoute)}, ${esc(salbDose)}, first dose at ${esc(salbTime)}. Response: ${esc(salbResp)}. Repeat doses: ${esc(salbRepeat)} (${esc(salbFreq)}).`);
    }

    const ipraGiven = radioVal('ipra-given');
    if (ipraGiven === 'Yes') {
      lines.push(`Ipratropium bromide: given, ${esc($('ipra-dose').value || '—')} at ${esc($('ipra-time').value || '—')}.`);
    } else if (ipraGiven === 'No') {
      lines.push('Ipratropium bromide: not given.');
    }

    const steroidGiven = radioVal('steroid-given');
    if (steroidGiven === 'Yes') {
      const route = radioVal('steroid-route') || '—';
      const drug = $('steroid-drug').value || '—';
      const dose = $('steroid-dose').value || '—';
      const time = $('steroid-time').value || '—';
      const maintNote = $('steroid-maintenance').checked ? ' (on maintenance steroids)' : '';
      lines.push(`Steroids: ${esc(drug)} ${esc(dose)} (${esc(route)}) at ${esc(time)}${maintNote}.`);
    } else if (steroidGiven === 'No') {
      lines.push('Steroids: not given.');
    }

    const mgso4Given = radioVal('mgso4-given');
    if (mgso4Given === 'Yes') {
      const route = radioVal('mgso4-route') || '—';
      const dose = $('mgso4-dose').value || '—';
      const time = $('mgso4-time').value || '—';
      lines.push(`Magnesium sulfate: given (${esc(route)}), ${esc(dose)} at ${esc(time)}.`);
      if ($('mgso4-not-responding').checked) {
        lines.push('<b>Not responding within 15 min — discussed with on-call paediatric consultant.</b>');
      }
    } else if (mgso4Given === 'No') {
      lines.push('Magnesium sulfate: not given.');
    }

    const secondLineGiven = radioVal('secondline-given');
    if (secondLineGiven === 'Yes') {
      const agent = radioVal('secondline-agent') || '—';
      const dose = $('secondline-dose').value || '—';
      const infusion = $('secondline-infusion').value || '—';
      const time = $('secondline-time').value || '—';
      lines.push(`<b>Second-line IV bronchodilator:</b> ${esc(agent)} — ${esc(dose)}; maintenance: ${esc(infusion)}; given at ${esc(time)}.`);
    } else if (secondLineGiven === 'No') {
      lines.push('Second-line IV bronchodilator: not given.');
    }

    const heliox = radioVal('heliox-amino');
    if (heliox) lines.push(`Heliox (consultant-level): ${esc(heliox)}`);
    const itu = radioVal('itu-referral');
    if (itu) lines.push(`ITU/PICU referral made: ${itu === 'Yes' ? '<b>YES</b>' : itu}`);

    const o2Required = radioVal('o2-required');
    if (o2Required === 'Yes') {
      const delivery = $('o2-delivery').value || '—';
      const flow = $('o2-flow').value ? `${$('o2-flow').value} L/min` : '—';
      lines.push(`Oxygen: ${esc(delivery)}, ${esc(flow)}, target SpO2 94-98%.`);
    } else if (o2Required === 'No') {
      lines.push('Oxygen: not required.');
    }

    const monitors = getCheckedValues('.monitor-cb');
    if (monitors.length) {
      lines.push(`Monitoring (IV therapies): ${esc(monitors.join(', '))}.`);
    }
    lines.push('Note: Antibiotics not given routinely.');
    lines.push('');

    // Investigations
    lines.push('<b>INVESTIGATIONS</b>');
    const cxr = radioVal('cxr-ordered');
    if (cxr === 'Yes') {
      lines.push(`CXR: ordered${$('cxr-result').value ? ` — ${esc($('cxr-result').value)}` : ', result pending'}.`);
    } else if (cxr === 'No') {
      lines.push('CXR: not ordered (not routinely indicated unless severe/life-threatening and not improving).');
    }
    const gas = radioVal('bloodgas');
    if (gas === 'Yes') {
      const ph = $('gas-ph').value || '—';
      const pco2 = $('gas-pco2').value || '—';
      const po2 = $('gas-po2').value || '—';
      const hco3 = $('gas-hco3').value || '—';
      const lactate = $('gas-lactate').value || '—';
      lines.push(`Blood gas: pH ${esc(ph)}, pCO2 ${esc(pco2)}, pO2 ${esc(po2)}, HCO3 ${esc(hco3)}, lactate ${esc(lactate)}.`);
    } else if (gas === 'No') {
      lines.push('Blood gas: not performed.');
    }
    const cultures = radioVal('bloodcultures');
    if (cultures) lines.push(`Blood cultures: ${esc(cultures)}`);
    const fbccrp = radioVal('fbc-crp');
    if (fbccrp) lines.push(`FBC/CRP: ${esc(fbccrp)}`);
    lines.push('');

    // Response
    lines.push('<b>RESPONSE & REASSESSMENT</b>');
    const rSpo2 = $('reassess-spo2').value ? `${$('reassess-spo2').value}%` : '—';
    const rRR = $('reassess-rr').value || '—';
    const rHR = $('reassess-hr').value || '—';
    lines.push(`Post-treatment: SpO2 ${esc(rSpo2)}, RR ${esc(rRR)}, HR ${esc(rHR)}.`);
    const response = radioVal('response');
    if (response) lines.push(`Response to treatment: ${esc(response)}`);
    const severityPost = $('severity-post').value;
    if (severityPost) lines.push(`Severity post-treatment: ${esc(severityPost)}`);
    lines.push('');

    // Disposition
    lines.push('<b>DISPOSITION & FOLLOW-UP</b>');
    const admissionCriteria = radioVal('admission-criteria');
    if (admissionCriteria) lines.push(`Admission criteria present: ${esc(admissionCriteria)}`);
    const disposition = $('disposition').value;
    if (disposition) lines.push(`Disposition: ${esc(disposition)}`);

    const dcMet = getCheckedValues('.dc-cb');
    if (dcMet.length) lines.push(`Discharge criteria met: ${esc(dcMet.join(', '))}`);

    const dischargeMeds = getCheckedValues('.dm-cb');
    if (dischargeMeds.length) lines.push(`Discharge medications/plan: ${esc(dischargeMeds.join(', '))}`);

    const actionPlan = radioVal('action-plan');
    if (actionPlan) lines.push(`Asthma action plan given: ${esc(actionPlan)}`);
    const safetyNet = radioVal('safety-netting');
    if (safetyNet) lines.push(`Safety netting advice given: ${esc(safetyNet)}`);

    const clinician = $('responsible-clinician').value;
    if (clinician) lines.push(`Responsible clinician: ${esc(clinician)}`);
    const senior = $('senior-review').value;
    if (senior) lines.push(`Senior review by: ${esc(senior)}`);

    return lines.join('<br>');
  }

  function updateNotes() {
    const output = $('epr-output');
    if (output) {
      output.innerHTML = generateEPRNote();
    }
    clearTimeout(saveTimeout);
    saveTimeout = setTimeout(saveState, 300);
  }
  window.updateNotes = updateNotes;

  function runAllCalculationsAndNotes() {
    updateSpo2Flag();
    updatePefrFlag();
    updateAgeAdjustedNotes();
    updateSeverityBanner();
    updateDoseCalculations();
    updateNotes();
  }

  // ----------------------------------------------------------
  // GLOBAL EVENT BINDING — all inputs trigger updateNotes()
  // ----------------------------------------------------------
  form.addEventListener('input', updateNotes);
  form.addEventListener('change', updateNotes);

  // ----------------------------------------------------------
  // PRINT
  // ----------------------------------------------------------
  function doPrint() { window.print(); }
  $('print-btn').addEventListener('click', doPrint);
  $('print-btn-panel').addEventListener('click', doPrint);

  // ----------------------------------------------------------
  // RESET
  // ----------------------------------------------------------
  $('reset-btn').addEventListener('click', () => {
    if (!confirm('Reset the entire form? This will clear all entered data and cannot be undone.')) return;
    form.reset();
    document.querySelectorAll('.sev-cb, .trigger-cb, .othersym-cb, .dc-cb, .dm-cb, .monitor-cb').forEach(cb => cb.checked = false);
    document.querySelectorAll('input[type="text"], input[type="number"], input[type="time"], input[type="date"]').forEach(el => {
      el.value = '';
      delete el.dataset.manual;
    });
    document.querySelectorAll('textarea').forEach(el => el.value = '');
    document.querySelectorAll('select').forEach(el => el.selectedIndex = 0);
    $('pt-age').value = '';
    try { localStorage.removeItem(STORAGE_KEY); } catch (e) { /* ignore */ }
    toggleAsthmaticDetails();
    togglePrevVisitsCount();
    toggleRelieverDoses();
    toggleTriggerOther();
    toggleDifferentialOther();
    $('prev-itu-alert').classList.add('hidden');
    runAllCalculationsAndNotes();
  });

  // ----------------------------------------------------------
  // INIT
  // ----------------------------------------------------------
  loadState();
  updateNotes();
});
