// Fahrzeugkontrolle – Web-App fürs iPad (ViamedGO Bonn)
(function () {
  'use strict';

  // ---------- Grunddaten ----------
  // Quelle: Fuhrpark Übersicht, Stand 18.11.2026. Nicht kontrolliert: BN-VM-28 (wird abgemeldet), BN-VM-90 (Cupra).
  const MODELLE = {
    'BN-VM-13': 'VW Caddy AMF-Bruns', 'BN-VM-16': 'VW Caddy AMF-Bruns', 'BN-VM-53': 'VW Caddy AMF-Bruns',
    'BN-VM-58': 'Mercedes Citan Tourer', 'BN-VM-60': 'Mercedes Citan AMF-Bruns', 'BN-VM-70': 'Citroën Berlingo',
    'BN-VM-74': 'Mercedes Citan Tourer AMF-Bruns', 'BN-VM-96': 'Mercedes Citan AMF-Bruns',
    'BN-VM-100': 'Mercedes Sprinter (Liegend)', 'BN-VM-300': 'Mercedes Sprinter', 'BN-VM-400': 'Mercedes Sprinter',
    'BN-VM-600': 'VW Crafter', 'BN-VM-901': 'VW Crafter'
  };
  const STANDARD_FAHRZEUGE = Object.keys(MODELLE);
  const PUNKTE_LINKS = ['Sommer-/Winterreifen', 'Alle Gurte i.O.', 'Scheibe', 'Sauberkeit Innenraum', 'Beleuchtung außen', 'Beleuchtung innen', 'Gebläse / Lüftung / Heizung'];
  const PUNKTE_RECHTS = ['Fahrzeugschein', 'Tankkarte', 'Verbandkasten', 'Warnweste', 'Warndreieck', 'Handy', 'Tragestuhl / Fahrtrage i.O.', 'Rollbrett', 'Kraftstoff', 'AdBlue', 'Scheibenwaschwasser', 'Kühlwasser', 'Ölstand OK'];
  const PUNKTE = [...PUNKTE_LINKS, ...PUNKTE_RECHTS];
  const RAEDER = [['VL', 'Vorne links'], ['VR', 'Vorne rechts'], ['HL', 'Hinten links'], ['HR', 'Hinten rechts']];
  const FOTO_ARTEN = ['Vorne', 'Hinten', 'Links', 'Rechts', 'Innenraum', 'Tacho', 'Mangel', 'Sonstiges'];
  const MONATE = ['Januar', 'Februar', 'März', 'April', 'Mai', 'Juni', 'Juli', 'August', 'September', 'Oktober', 'November', 'Dezember'];
  const BESTAETIGUNG = 'Ich bin im Besitz eines gültigen Führerscheins der Klasse B und eines gültigen Personenbeförderungsscheins.';

  // ---------- Speicher (nur auf diesem Gerät) ----------
  const store = {
    get(k, d) { try { const v = localStorage.getItem('fk_' + k); return v ? JSON.parse(v) : d; } catch (e) { return d; } },
    set(k, v) { localStorage.setItem('fk_' + k, JSON.stringify(v)); }
  };
  const fahrzeuge = () => store.get('fahrzeuge', STANDARD_FAHRZEUGE);
  const verlauf = () => store.get('verlauf', {});
  // Nächster Service je Fahrzeug (km), bleibt gespeichert, bis ein neuer Wert eingetragen wird
  const services = () => store.get('service', {});
  // Wer darf kontrollieren? Liste für die Auswahl im Formular (in ⚙︎ änderbar)
  // Namen nicht im öffentlichen Code: werden am iPad unter Einstellungen angelegt.
  const STANDARD_PRUEFER = [];
  const prueferListe = () => store.get('prueferListe', STANDARD_PRUEFER);
  const einst = () => Object.assign({ pruefer: '', gelbAb: 15, rotAb: 22 }, store.get('einst', {}));

  // ---------- Hilfen ----------
  const $ = (sel, el = document) => el.querySelector(sel);
  const h = (tag, attrs = {}, ...kids) => {
    const el = document.createElement(tag);
    for (const [k, v] of Object.entries(attrs)) {
      if (k === 'class') el.className = v;
      else if (k.startsWith('on')) el.addEventListener(k.slice(2), v);
      else if (v === true) el.setAttribute(k, '');
      else if (v !== false && v != null) el.setAttribute(k, v);
    }
    for (const kid of kids.flat()) if (kid != null && kid !== false) el.append(kid.nodeType ? kid : String(kid));
    return el;
  };
  const pad = n => String(n).padStart(2, '0');
  const isoDatum = d => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
  const deDatum = iso => { const [y, m, d] = iso.split('-'); return `${d}.${m}.${y}`; };
  function kw(d) {
    const t = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
    const day = t.getUTCDay() || 7; t.setUTCDate(t.getUTCDate() + 4 - day);
    const y0 = new Date(Date.UTC(t.getUTCFullYear(), 0, 1));
    return Math.ceil(((t - y0) / 86400000 + 1) / 7);
  }
  const tageSeit = iso => Math.floor((new Date(isoDatum(new Date())) - new Date(iso)) / 86400000);
  const kmText = n => Number(n).toLocaleString('de-DE') + ' km';
  const dateiKz = kz => kz.replace(/\s+/g, '').toUpperCase();

  // ---------- Kopfleiste ----------
  const titleEl = $('#title'), backBtn = $('#backBtn'), settingsBtn = $('#settingsBtn'), app = $('#app');
  let zurueck = null;
  backBtn.onclick = () => zurueck && zurueck();
  settingsBtn.onclick = () => zeigeEinstellungen();
  const subEl = $('#sub');
  const WOCHENTAGE = ['Sonntag', 'Montag', 'Dienstag', 'Mittwoch', 'Donnerstag', 'Freitag', 'Samstag'];
  function gruss() {
    const d = new Date(), std = d.getHours(), name = (einst().pruefer || '').split(' ')[0];
    const g = std < 11 ? 'Guten Morgen' : std < 18 ? 'Hallo' : 'Guten Abend';
    return `${g}${name ? ', ' + name : ''} · ${WOCHENTAGE[d.getDay()]}, ${d.getDate()}. ${MONATE[d.getMonth()]}`;
  }
  function kopf(titel, back, sub) {
    titleEl.textContent = titel; subEl.textContent = sub || ''; zurueck = back || null;
    document.body.classList.toggle('start', !back);
    backBtn.classList.toggle('hidden', !back); settingsBtn.classList.toggle('hidden', !!back);
    window.scrollTo(0, 0);
  }

  // ---------- Fahrzeug-Zeichnungen (ViamedGO-Look: weiß, grüner Streifen, Kreuz) ----------
  const RAD = (x, y = 104, r = 17) => `<circle cx="${x}" cy="${y}" r="${r}" fill="#1b1b1b"/><circle cx="${x}" cy="${y}" r="${r * .5}" fill="#c8ccc6"/><circle cx="${x}" cy="${y}" r="${r * .18}" fill="#777"/>`;
  const KREUZ = (x, y, g = 30) => `<g transform="translate(${x} ${y})"><rect x="${g * .3}" y="0" width="${g * .4}" height="${g}" fill="#58b133"/><rect x="0" y="${g * .3}" width="${g}" height="${g * .4}" fill="#58b133"/></g>`;
  const ZEICHNUNG = {
    sprinter: `<ellipse cx="160" cy="121" rx="140" ry="6" fill="#000" opacity=".25"/>
      <path d="M18 104V36c0-12 8-20 20-20h168c10 0 16 4 22 10l34 34 30 8c10 3 16 10 16 20v16c0 4-3 6-6 6H24c-3 0-6-2-6-6z" fill="#fbfbfb" stroke="#cfd5cb" stroke-width="2"/>
      <path d="M206 22h4c8 0 12 3 17 8l30 30h-51z" fill="#2a3a46"/><path d="M210 28l38 32" stroke="#fff" stroke-opacity=".35" stroke-width="3"/>
      <rect x="30" y="30" width="44" height="24" rx="4" fill="#2a3a46"/><rect x="80" y="30" width="44" height="24" rx="4" fill="#2a3a46"/>
      <path d="M18 70h300v12H18z" fill="#58b133"/><path d="M18 82h300v4H18z" fill="#a2cb85"/>${KREUZ(140, 34)}
      <path d="M180 30v74M128 30v74" stroke="#dfe4dc" stroke-width="2"/><rect x="290" y="74" width="16" height="6" rx="2" fill="#ffd96a"/><rect x="20" y="58" width="6" height="10" rx="2" fill="#e04343"/>
      ${RAD(72)}${RAD(256)}`,
    crafter: `<ellipse cx="160" cy="121" rx="140" ry="6" fill="#000" opacity=".25"/>
      <path d="M16 104V34c0-11 7-18 18-18h184c8 0 13 3 17 9l24 38 34 7c10 2 15 9 15 19v16c0 4-3 6-6 6H22c-3 0-6-2-6-6z" fill="#fbfbfb" stroke="#cfd5cb" stroke-width="2"/>
      <path d="M218 22h3c6 0 9 2 12 7l22 35h-37z" fill="#2a3a46"/><path d="M222 28l26 34" stroke="#fff" stroke-opacity=".35" stroke-width="3"/>
      <rect x="28" y="28" width="52" height="24" rx="3" fill="#2a3a46"/><rect x="86" y="28" width="40" height="24" rx="3" fill="#2a3a46"/>
      <path d="M16 72h302v11H16z" fill="#58b133"/><path d="M16 83h302v4H16z" fill="#a2cb85"/>${KREUZ(146, 32)}
      <path d="M190 28v76M134 28v76" stroke="#dfe4dc" stroke-width="2"/><rect x="292" y="76" width="18" height="6" rx="2" fill="#ffd96a"/><path d="M300 92h16" stroke="#9aa39a" stroke-width="3"/><rect x="18" y="56" width="6" height="12" rx="2" fill="#e04343"/>
      ${RAD(70)}${RAD(258)}`,
    klein: `<ellipse cx="160" cy="121" rx="128" ry="6" fill="#000" opacity=".25"/>
      <path d="M36 104V46c0-10 6-16 16-16h132c8 0 13 3 18 8l26 28h30c11 0 18 7 18 17v15c0 4-3 6-6 6H42c-3 0-6-2-6-6z" fill="#fbfbfb" stroke="#cfd5cb" stroke-width="2"/>
      <path d="M186 36h3c5 0 8 2 11 5l22 25h-36z" fill="#2a3a46"/><path d="M190 42l24 22" stroke="#fff" stroke-opacity=".35" stroke-width="3"/>
      <rect x="48" y="40" width="40" height="22" rx="4" fill="#2a3a46"/><rect x="94" y="40" width="40" height="22" rx="4" fill="#2a3a46"/>
      <path d="M36 74h240v10H36z" fill="#58b133"/><path d="M36 84h240v4H36z" fill="#a2cb85"/><path d="M276 74c4 0 10 4 10 10H276z" fill="#58b133"/>
      ${KREUZ(149, 39, 24)}<path d="M138 40v64" stroke="#dfe4dc" stroke-width="2"/><rect x="268" y="76" width="16" height="6" rx="2" fill="#ffd96a"/><rect x="38" y="62" width="6" height="10" rx="2" fill="#e04343"/>
      ${RAD(86, 104, 15)}${RAD(240, 104, 15)}`
  };
  function wagenTyp(kz) { const m = MODELLE[kz] || ''; return /Sprinter/.test(m) ? 'sprinter' : /Crafter/.test(m) ? 'crafter' : 'klein'; }
  function wagen(kz) {
    const d = document.createElement('div');
    d.innerHTML = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 320 130" class="wagen">${ZEICHNUNG[wagenTyp(kz)]}</svg>`;
    return d.firstChild;
  }

  // ---------- Startseite ----------
  function zeigeStart() {
    kopf('Fahrzeugkontrolle', null, gruss());
    const e = einst(), v = verlauf(); const zaehler = { faellig: 0, bald: 0, ok: 0 };
    const karten = fahrzeuge().map(kz => {
      const liste = v[kz] || [], letzte = liste[liste.length - 1];
      let cls = 'faellig', badge = 'Neu', info = '';
      if (letzte) {
        const t = tageSeit(letzte.datum);
        cls = t >= e.rotAb ? 'faellig' : t >= e.gelbAb ? 'bald' : 'ok';
        badge = cls === 'ok' ? (t === 0 ? 'Heute kontrolliert' : 'In Ordnung') : cls === 'bald' ? 'Bald fällig' : `Fällig seit ${t - e.rotAb + 1} ${t - e.rotAb + 1 === 1 ? 'Tag' : 'Tagen'}`;
                info = `Letzte Kontrolle ${deDatum(letzte.datum)}${letzte.pruefer ? ' von ' + letzte.pruefer : ''} · ${letzte.km ? kmText(letzte.km) + ' · ' : ''}${letzte.maengel ? letzte.maengel + (letzte.maengel === 1 ? ' Mangel' : ' Mängel') : 'ohne Mängel'}`;
      }
      zaehler[cls]++;
      const tage = letzte ? tageSeit(letzte.datum) : null;
      const sv = services()[kz];
      let serviceInfo = null;
      if (sv) {
        const rest = letzte && letzte.km ? sv - letzte.km : null;
        serviceInfo = rest != null && rest <= 0 ? h('span', { class: 'pill rot' }, `🔧 Service fällig`)
          : h('span', { class: 'pill' }, `🔧 Service ${rest != null ? 'in ' + kmText(rest) : 'bei ' + kmText(sv)}`);
      }
      const zahl = tage == null ? h('div', { class: 'zahl' }, '–', h('small', {}, 'noch nie kontrolliert'))
        : h('div', { class: 'zahl' }, String(tage), h('small', {}, tage === 1 ? 'Tag seit Kontrolle' : 'Tage seit Kontrolle'));
      return h('button', { class: 'car ' + cls, onclick: () => zeigeFormular(kz) },
        h('div', { class: 'car-kopf' }, h('div', {}, h('div', { class: 'kz' }, kz), MODELLE[kz] && h('div', { class: 'modell' }, MODELLE[kz])),
          h('span', { class: 'badge' }, badge)),
        wagen(kz),
        h('div', { class: 'car-infos' }, info && h('span', { class: 'info' }, info), serviceInfo),
        h('div', { class: 'car-fuss' }, zahl, h('span', { class: 'pfeil' }, '›')));
    });
    const kachel = (n, txt, cls) => h('div', { class: 'stat ' + cls }, h('b', {}, String(n)), h('span', {}, txt));
    app.replaceChildren(
      h('div', { class: 'stats' }, kachel(zaehler.faellig, 'fällig', 'faellig'), kachel(zaehler.bald, 'bald fällig', 'bald'), kachel(zaehler.ok, 'erledigt', 'ok')),
      h('h2', {}, h('span', { class: 'ico' }, '🚐'), 'Unsere Fahrzeuge'),
      h('div', { class: 'grid' }, karten),
      h('p', { class: 'legend' }, `Grün: unter ${e.gelbAb} Tagen · Gelb: ab ${e.gelbAb} Tagen · Rot: ab ${e.rotAb} Tagen oder noch nie. Der Verlauf wird nur auf diesem iPad gespeichert.`)
    );
  }

  // ---------- Einstellungen ----------
  function zeigeEinstellungen() {
    kopf('Einstellungen', zeigeStart);
    const e = einst();
    const liste = h('ul', { class: 'list' });
    const neu = h('input', { type: 'text', placeholder: 'z. B. BN-VM-500', autocapitalize: 'characters' });
    function zeichne() {
      liste.replaceChildren(...fahrzeuge().map(kz => h('li', {}, h('b', {}, kz),
        h('button', { class: 'btn danger', onclick: () => { if (confirm(`${kz} aus der Liste nehmen? Der Verlauf bleibt gespeichert.`)) { store.set('fahrzeuge', fahrzeuge().filter(x => x !== kz)); zeichne(); } } }, 'Entfernen'))));
    }
    zeichne();
    const namen = h('ul', { class: 'list' });
    const neuName = h('input', { type: 'text', placeholder: 'Name, mehrere mit Komma', autocapitalize: 'words' });
    function zeichneNamen() {
      namen.replaceChildren(...prueferListe().map(n => h('li', {}, h('b', {}, n),
        h('button', { class: 'btn danger', onclick: () => { if (confirm(`${n} aus der Auswahl nehmen? Alte Kontrollen behalten den Namen.`)) { store.set('prueferListe', prueferListe().filter(x => x !== n)); zeichneNamen(); } } }, 'Entfernen'))));
    }
    zeichneNamen();
    const gelb = h('input', { type: 'number', value: e.gelbAb, min: 1 });
    const rot = h('input', { type: 'number', value: e.rotAb, min: 1 });
    app.replaceChildren(
      h('h2', {}, h('span', { class: 'ico' }, '🚐'), 'Fahrzeuge'),
      h('div', { class: 'card' }, liste,
        h('div', { class: 'fields', style: 'margin-top:12px' }, h('label', { class: 'f' }, 'Neues Kennzeichen', neu),
          h('button', { class: 'btn', style: 'align-self:end', onclick: () => {
            const kz = neu.value.trim().toUpperCase(); if (!kz) return;
            if (!fahrzeuge().includes(kz)) store.set('fahrzeuge', [...fahrzeuge(), kz]);
            neu.value = ''; zeichne();
          } }, 'Hinzufügen'))),
      h('h2', {}, h('span', { class: 'ico' }, '👤'), 'Wer kontrolliert'),
      h('div', { class: 'card' }, namen,
        h('div', { class: 'fields', style: 'margin-top:12px' }, h('label', { class: 'f' }, 'Neuer Name', neuName),
          h('button', { class: 'btn', style: 'align-self:end', onclick: () => {
            // mehrere Namen auf einmal: mit Komma trennen
            const liste = neuName.value.split(/[,;\n]/).map(x => x.trim().replace(/\s+/g, ' ')).filter(Boolean); if (!liste.length) return;
            store.set('prueferListe', [...new Set([...prueferListe(), ...liste])]);
            neuName.value = ''; zeichneNamen();
          } }, 'Hinzufügen'))),
      h('h2', {}, h('span', { class: 'ico' }, '⚙️'), 'Allgemein'),
      h('div', { class: 'card fields' },
        h('label', { class: 'f' }, 'Gelb ab Tagen', gelb),
        h('label', { class: 'f' }, 'Rot ab Tagen', rot)),
      h('div', { style: 'margin-top:20px' }, h('button', { class: 'btn big', onclick: () => {
        store.set('einst', { pruefer: e.pruefer, gelbAb: +gelb.value || 15, rotAb: +rot.value || 22 }); zeigeStart();
      } }, 'Speichern'))
    );
  }

  // ---------- Formular ----------
  function zeigeFormular(kz) {
    const jetzt = new Date();
    const st = { kz, punkte: {}, notizen: {}, fotos: [], unterschrift: false };
    let geaendert = false;
    kopf(kz, () => { if (!geaendert || confirm('Kontrolle abbrechen? Eingaben gehen verloren.')) zeigeStart(); }, (MODELLE[kz] || '') + ' · Kontrolle vom ' + deDatum(isoDatum(jetzt)));

    const inp = (attrs) => { const el = h('input', attrs); el.addEventListener('input', () => geaendert = true); return el; };
    const datum = inp({ type: 'date', value: isoDatum(jetzt) });
    const km = inp({ type: 'number', inputmode: 'numeric', placeholder: 'z. B. 160683' });
    const letzte = (verlauf()[kz] || []).slice(-1)[0] || {};
    const tuev = inp({ type: 'text', placeholder: 'MM/JJ', value: letzte.tuev || '' });
    const gespeichert = services()[kz];
    const service = inp({ type: 'number', inputmode: 'numeric', placeholder: 'km, z. B. 215000', value: gespeichert || '' });
    const serviceHinweis = h('span', { style: 'font-size:13px' });
    const serviceAendern = h('button', { class: 'btn sec', style: 'padding:8px 12px;margin-top:4px', onclick: () => { service.disabled = false; service.value = ''; service.focus(); serviceAendern.classList.add('hidden'); pruefeService(); } }, 'Neu eintragen');
    if (gespeichert) service.disabled = true; else serviceAendern.classList.add('hidden');
    function pruefeService() {
      const sv = +service.value, k = +km.value;
      if (sv && k && k >= sv) { serviceHinweis.textContent = 'Service fällig! Nach dem Service neuen Wert eintragen.'; serviceHinweis.style.color = 'var(--rot)'; }
      else if (sv && k) { serviceHinweis.textContent = 'Noch ' + kmText(sv - k); serviceHinweis.style.color = 'var(--grau)'; }
      else if (gespeichert && service.disabled) { serviceHinweis.textContent = 'Gespeichert'; serviceHinweis.style.color = 'var(--grau)'; }
      else serviceHinweis.textContent = '';
    }
    km.addEventListener('input', pruefeService); service.addEventListener('input', pruefeService);
    const reifenArt = h('select', {}, ['', 'Sommer', 'Winter', 'Ganzjahr'].map(x => h('option', { value: x, selected: x === (letzte.reifenArt || '') }, x || 'bitte wählen')));
    const zuletzt = einst().pruefer;
    const pruefer = h('select', { onchange: () => { geaendert = true; } },
      h('option', { value: '' }, prueferListe().length ? 'Bitte Namen wählen' : 'Erst Namen in ⚙︎ Einstellungen anlegen'),
      prueferListe().map(n => h('option', { value: n, selected: n === zuletzt }, n)));
    // Fahrer des Fahrzeugs
    const fahrerNamen = [...new Set([...prueferListe(), ...store.get('fahrerListe', [])])];
    const fahrerListeEl = h('datalist', { id: 'fahrerNamen' }, fahrerNamen.map(n => h('option', { value: n })));
    const fahrer = inp({ type: 'text', list: 'fahrerNamen', placeholder: 'Name des Fahrers', value: letzte.fahrer || '', autocapitalize: 'words' });
    const fsBtns = [['ja', '✓ Ja, dabei'], ['nein', '✕ Nein']].map(([w, t]) => h('button', { class: w === 'ja' ? 'ok' : 'mangel', onclick: () => {
      st.fuehrerschein = w; geaendert = true; fsBtns.forEach(b => b.classList.toggle('on', b === fsBtns[w === 'ja' ? 0 : 1]));
      fsFotoBox.classList.toggle('hidden', w !== 'ja');
    } }, t));
    const fsBild = h('div', { class: 'photos' });
    function zeichneFs() {
      fsBild.replaceChildren(...(st.fsFoto ? [h('div', { class: 'photo' }, h('img', { src: st.fsFoto.url, alt: '' }),
        h('button', { onclick: () => { URL.revokeObjectURL(st.fsFoto.url); st.fsFoto = null; zeichneFs(); } }, '×'))] : []));
      fsKnopf.textContent = st.fsFoto ? '📷 Neu aufnehmen' : '📷 Führerschein fotografieren';
    }
    async function fsDazu(file) {
      if (!file) return;
      try { if (st.fsFoto) URL.revokeObjectURL(st.fsFoto.url); st.fsFoto = await bildVorbereiten(file, 1600, 0.85); st.fsFoto.art = 'Führerschein'; geaendert = true; }
      catch (e) { alert('Das Foto konnte nicht gelesen werden.'); }
      zeichneFs();
    }
    const fsKamera = h('input', { type: 'file', accept: 'image/*', capture: 'environment', class: 'hidden', onchange: e => { fsDazu(e.target.files[0]); e.target.value = ''; } });
    const fsGalerie = h('input', { type: 'file', accept: 'image/*', class: 'hidden', onchange: e => { fsDazu(e.target.files[0]); e.target.value = ''; } });
    const fsKnopf = h('span', { class: 'btn', onclick: () => fsKamera.click() }, '📷 Führerschein fotografieren');
    const fsFotoBox = h('div', { class: 'hidden', style: 'margin-top:14px' },
      h('div', { class: 'photobtns' }, h('label', {}, fsKamera, fsKnopf), h('label', {}, fsGalerie, h('span', { class: 'btn sec', onclick: () => fsGalerie.click() }, 'Aus Fotos wählen'))),
      fsBild);
    const sonstiges = h('textarea', { placeholder: 'Schäden, Auffälligkeiten, was fehlt …', oninput: () => geaendert = true });

    const reifen = {};
    const reifenBox = h('div', { class: 'tyres' }, RAEDER.map(([k, name]) => {
      reifen[k] = { mm: inp({ type: 'number', step: '0.1', inputmode: 'decimal', placeholder: 'mm' }), bar: inp({ type: 'number', step: '0.1', inputmode: 'decimal', placeholder: 'bar' }) };
      return h('div', { class: 'tyre' }, h('b', {}, name), h('div', { class: 'row' }, reifen[k].mm, reifen[k].bar));
    }));

    const itemEls = {};
    function punktEl(name) {
      const note = h('input', { type: 'text', class: 'note hidden', placeholder: 'Was ist los?', oninput: e => { st.notizen[name] = e.target.value; geaendert = true; } });
      const btns = [['ok', '✓ i.O.'], ['mangel', '✕ Mangel'], ['nv', '–']].map(([wert, txt]) =>
        h('button', { class: wert, onclick: () => setze(name, wert) }, txt));
      const el = h('div', { class: 'item offen' }, h('div', { class: 'name' }, name), h('div', { class: 'seg' }, btns), note);
      itemEls[name] = { el, btns, note };
      return el;
    }
    const fortText = h('span', {}, ''), fortBalken = h('i', {});
    const fortschritt = h('div', { class: 'fortschritt' }, h('div', { class: 'fb-in' }, h('div', { class: 'fb-top' }, h('b', {}, 'Checkliste'), fortText), h('div', { class: 'fb-bar' }, fortBalken)));
    function zeigeFortschritt() {
      const n = PUNKTE.filter(p => st.punkte[p]).length, m = PUNKTE.filter(p => st.punkte[p] === 'mangel').length;
      fortText.textContent = `${n} von ${PUNKTE.length} geprüft${m ? ' · ' + m + (m === 1 ? ' Mangel' : ' Mängel') : ''}`;
      fortBalken.style.width = (n / PUNKTE.length * 100) + '%';
      fortschritt.classList.toggle('fertig', n === PUNKTE.length);
    }
    function setze(name, wert) {
      st.punkte[name] = wert; geaendert = true;
      const it = itemEls[name];
      it.el.classList.remove('offen');
      it.btns.forEach(b => b.classList.toggle('on', b.classList.contains(wert)));
      it.note.classList.toggle('hidden', wert !== 'mangel' && !it.note.value);
      zeigeFortschritt();
      if (wert === 'mangel') it.note.focus();
    }
    const alleOk = liste => h('button', { class: 'btn sec allok', onclick: () => liste.forEach(n => { if (!st.punkte[n]) setze(n, 'ok'); }) }, 'Alle offenen auf i.O.');

    // Fotos
    const fotoGrid = h('div', { class: 'photos' });
    function zeichneFotos() {
      fotoGrid.replaceChildren(...st.fotos.map((f, i) => h('div', { class: 'photo' },
        h('img', { src: f.url, alt: '' }),
        h('button', { onclick: () => { URL.revokeObjectURL(f.url); st.fotos.splice(i, 1); zeichneFotos(); } }, '×'),
        h('select', { onchange: e => f.art = e.target.value }, FOTO_ARTEN.map(a => h('option', { selected: a === f.art }, a))))));
    }
    async function fotosDazu(files) {
      for (const file of files) {
        try {
          const img = await bildVorbereiten(file, 1600, 0.82);
          img.art = FOTO_ARTEN[Math.min(st.fotos.length, 5)];
          st.fotos.push(img); geaendert = true;
        } catch (e) { alert('Ein Foto konnte nicht gelesen werden.'); }
      }
      zeichneFotos();
    }
    const kamera = h('input', { type: 'file', accept: 'image/*', capture: 'environment', class: 'hidden', onchange: e => { fotosDazu([...e.target.files]); e.target.value = ''; } });
    const galerie = h('input', { type: 'file', accept: 'image/*', multiple: true, class: 'hidden', onchange: e => { fotosDazu([...e.target.files]); e.target.value = ''; } });

    // Unterschrift
    const sig = h('canvas', { class: 'sig' });
    const sigCtl = unterschriftFeld(sig, () => { st.unterschrift = true; geaendert = true; });
    const bestaetigt = h('input', { type: 'checkbox' });
    const meldung = h('div', { class: 'msg hidden' });

    app.replaceChildren(
      fortschritt,
      h('h2', {}, h('span', { class: 'ico' }, '🚐'), 'Fahrzeug'),
      h('div', { class: 'card fields' },
        h('label', { class: 'f' }, 'Datum', datum),
        h('label', { class: 'f' }, 'KM-Stand *', km),
        h('label', { class: 'f' }, 'TÜV / HU', tuev),
        h('label', { class: 'f' }, 'Nächster Service bei (km)', service, serviceHinweis, serviceAendern),
        h('label', { class: 'f' }, 'Reifen', reifenArt)),
      h('h2', {}, h('span', { class: 'ico' }, '🧑‍✈️'), 'Fahrer des Fahrzeugs'),
      h('div', { class: 'card' },
        h('label', { class: 'f' }, 'Wer ist das Fahrzeug gefahren? *', fahrer, fahrerListeEl),
        h('div', { class: 'f', style: 'margin-top:14px;font-size:14px;font-weight:600;color:var(--grau)' }, 'Führerschein dabei? *'),
        h('div', { class: 'seg', style: 'margin-top:6px;max-width:420px' }, fsBtns),
        fsFotoBox),
      h('h2', {}, h('span', { class: 'ico' }, '🛞'), 'Profiltiefe / Reifendruck'),
      reifenBox,
      h('h2', {}, h('span', { class: 'ico' }, '🔧'), 'Technik und Zustand'), alleOk(PUNKTE_LINKS),
      h('div', { class: 'items' }, PUNKTE_LINKS.map(punktEl)),
      h('h2', {}, h('span', { class: 'ico' }, '🧰'), 'Ausstattung und Flüssigkeiten'), alleOk(PUNKTE_RECHTS),
      h('div', { class: 'items' }, PUNKTE_RECHTS.map(punktEl)),
      h('h2', {}, h('span', { class: 'ico' }, '📝'), 'Sonstiges'), sonstiges,
      h('h2', {}, h('span', { class: 'ico' }, '📸'), 'Fotos'),
      h('div', { class: 'photobtns' },
        h('label', {}, kamera, h('span', { class: 'btn', onclick: () => kamera.click() }, '📷 Foto aufnehmen')),
        h('label', {}, galerie, h('span', { class: 'btn sec', onclick: () => galerie.click() }, 'Aus Fotos wählen'))),
      fotoGrid,
      h('h2', {}, h('span', { class: 'ico' }, '✍️'), 'Bestätigung'),
      h('div', { class: 'card' },
        h('label', { class: 'check' }, bestaetigt, BESTAETIGUNG),
        h('label', { class: 'f', style: 'margin-top:14px' }, 'Kontrolle durchgeführt von *', pruefer),
        h('div', { style: 'margin-top:14px;display:flex;justify-content:space-between;align-items:center' }, h('span', { class: 'f', style: 'color:var(--grau);font-size:14px' }, 'Unterschrift *'),
          h('button', { class: 'btn sec', onclick: () => { sigCtl.leeren(); st.unterschrift = false; } }, 'Löschen')),
        sig),
      meldung,
      h('div', { class: 'footer' }, h('div', { class: 'in' },
        h('button', { class: 'btn big', onclick: abschliessen }, 'Fertig – speichern und ablegen')))
    );
    requestAnimationFrame(() => sigCtl.groesse());
    pruefeService(); zeigeFortschritt();

    async function abschliessen() {
      const fehler = [];
      if (!datum.value) fehler.push('Datum fehlt');
      if (!km.value) fehler.push('KM-Stand fehlt');
      if (!fahrer.value.trim()) fehler.push('Fahrer fehlt');
      if (!st.fuehrerschein) fehler.push('Führerschein dabei ja/nein fehlt');
      if (!pruefer.value) fehler.push('Name (wer kontrolliert hat) fehlt');
      if (!bestaetigt.checked) fehler.push('Bestätigung Führerschein / P-Schein fehlt');
      if (!st.unterschrift) fehler.push('Unterschrift fehlt');
      const offen = PUNKTE.filter(p => !st.punkte[p]);
      if (fehler.length) { meldung.className = 'msg'; meldung.textContent = 'Bitte ergänzen: ' + fehler.join(', ') + '.'; meldung.scrollIntoView({ behavior: 'smooth' }); return; }
      if (offen.length && !confirm(`${offen.length} Punkte sind noch nicht abgehakt (${offen.slice(0, 3).join(', ')}${offen.length > 3 ? ' …' : ''}). Trotzdem abschließen?`)) {
        itemEls[offen[0]].el.scrollIntoView({ behavior: 'smooth', block: 'center' }); return;
      }
      if (st.fuehrerschein === 'ja' && !st.fsFoto && !confirm('Es gibt noch kein Foto vom Führerschein. Trotzdem abschließen?')) { fsFotoBox.scrollIntoView({ behavior: 'smooth', block: 'center' }); return; }
      const d = new Date(datum.value + 'T12:00:00');
      const zeit = `${pad(jetzt.getHours())}${pad(jetzt.getMinutes())}`;
      const daten = {
        app: 'Fahrzeugkontrolle ViamedGO Bonn', version: 1,
        kennzeichen: kz, datum: datum.value, uhrzeit: `${pad(jetzt.getHours())}:${pad(jetzt.getMinutes())}`, kw: kw(d),
        kmStand: +km.value, tuevHu: tuev.value.trim(), naechsterServiceKm: service.value ? +service.value : null, serviceFaellig: !!(service.value && +km.value >= +service.value), reifenArt: reifenArt.value,
        reifen: Object.fromEntries(RAEDER.map(([k]) => [k, { profilMm: reifen[k].mm.value ? +reifen[k].mm.value : null, druckBar: reifen[k].bar.value ? +reifen[k].bar.value : null }])),
        punkte: PUNKTE.map(p => ({ punkt: p, status: st.punkte[p] === 'ok' ? 'i.O.' : st.punkte[p] === 'mangel' ? 'Mangel' : st.punkte[p] === 'nv' ? 'entfällt' : 'offen', notiz: (st.notizen[p] || '').trim() })),
        fahrer: fahrer.value.trim().replace(/\s+/g, ' '), fuehrerscheinDabei: st.fuehrerschein === 'ja', fuehrerscheinFoto: !!st.fsFoto,
        sonstiges: sonstiges.value.trim(), pruefer: pruefer.value.trim(), bestaetigungFuehrerschein: true,
        fotos: st.fotos.map((f, i) => f.art)
      };
      daten.maengel = daten.punkte.filter(p => p.status === 'Mangel').map(p => p.punkt + (p.notiz ? ': ' + p.notiz : ''));
      if (!daten.fuehrerscheinDabei) daten.maengel.unshift(`Führerschein nicht dabei (Fahrer: ${daten.fahrer})`);
      if (daten.serviceFaellig) daten.maengel.unshift(`Service fällig (KM-Stand ${kmText(daten.kmStand)}, Service bei ${kmText(daten.naechsterServiceKm)})`);

      meldung.className = 'msg info'; meldung.textContent = 'PDF wird erstellt …';
      try {
        const sigImg = await sigCtl.alsJpeg();
        const pdfFotos = st.fsFoto ? [...st.fotos, Object.assign({}, st.fsFoto, { art: 'Führerschein ' + daten.fahrer })] : st.fotos;
        const pdf = bauePdF(daten, pdfFotos, sigImg);
        const basis = `${dateiKz(kz)}_${daten.datum}_${zeit}`;
        const dateien = [
          new File([pdf], `${basis}_Checkliste.pdf`, { type: 'application/pdf' }),
          new File([JSON.stringify(daten, null, 2)], `${basis}_Daten.json`, { type: 'application/json' }),
          ...st.fotos.map((f, i) => new File([f.bytes], `${basis}_Foto-${pad(i + 1)}-${f.art}.jpg`, { type: 'image/jpeg' })),
          ...(st.fsFoto ? [new File([st.fsFoto.bytes], `${basis}_Fuehrerschein.jpg`, { type: 'image/jpeg' })] : [])
        ];
        const v = verlauf(); (v[kz] = v[kz] || []).push({ datum: daten.datum, km: daten.kmStand, maengel: daten.maengel.length, tuev: daten.tuevHu, reifenArt: daten.reifenArt, pruefer: daten.pruefer, fahrer: daten.fahrer, fuehrerschein: daten.fuehrerscheinDabei });
        store.set('verlauf', v);
        if (daten.naechsterServiceKm) { const sv = services(); sv[kz] = daten.naechsterServiceKm; store.set('service', sv); }
        store.set('einst', Object.assign(einst(), { pruefer: daten.pruefer }));
        if (!fahrerNamen.includes(daten.fahrer)) store.set('fahrerListe', [...store.get('fahrerListe', []), daten.fahrer]);
        meldung.className = 'msg hidden';
        geaendert = false;
        zeigeAblage(kz, dateien, daten);
      } catch (err) {
        console.error(err);
        meldung.className = 'msg'; meldung.textContent = 'Fehler beim Erstellen: ' + err.message;
      }
    }
  }

  // ---------- Ablage ----------
  function zeigeAblage(kz, dateien, daten) {
    kopf('Ablegen', zeigeStart);
    const d = new Date(daten.datum + 'T12:00:00');
    const ordner = `Dispo Bonn › Fahrzeugkontrolle › ${kz} › ${d.getFullYear()}-${pad(d.getMonth() + 1)} ${MONATE[d.getMonth()]} › ${daten.datum}`;
    const status = h('div', { class: 'msg info hidden' });
    const kannTeilen = !!(navigator.canShare && navigator.canShare({ files: dateien }));
    const links = h('div', { class: 'dl' }, dateien.map(f => h('a', { href: URL.createObjectURL(f), download: f.name }, '⬇︎ ' + f.name)));
    app.replaceChildren(
      h('div', { class: 'card' },
        h('p', {}, h('b', {}, 'Kontrolle gespeichert.'), ` ${daten.maengel.length ? daten.maengel.length + (daten.maengel.length === 1 ? ' Mangel' : ' Mängel') : 'Keine Mängel'}, ${dateien.length - 2} Fotos.`),
        h('p', {}, 'Ziel-Ordner: ', h('b', {}, ordner)),
        h('p', { class: 'legend' }, 'Tippe auf „Ablegen“ und wähle im Teilen-Menü den Kurzbefehl „Fahrzeugkontrolle ablegen“.')),
      h('div', { style: 'margin-top:16px;display:flex;flex-direction:column;gap:12px' },
        kannTeilen && h('button', { class: 'btn big', onclick: async () => {
          try { await navigator.share({ files: dateien, title: `Fahrzeugkontrolle ${kz} ${deDatum(daten.datum)}` }); status.className = 'msg info'; status.textContent = 'Übergeben. Bitte im Ordner kurz prüfen, ob alles angekommen ist.'; }
          catch (e) { if (e.name !== 'AbortError') { status.className = 'msg'; status.textContent = 'Teilen hat nicht geklappt: ' + e.message; } }
        } }, 'Ablegen'),
        !kannTeilen && h('div', { class: 'msg' }, 'Teilen ist hier nicht möglich. Dateien einzeln laden:'),
        !kannTeilen && links,
        status,
        h('button', { class: 'btn sec big', onclick: zeigeStart }, 'Zur Übersicht'))
    );
  }

  // ---------- Bilder ----------
  function ladeBild(src) {
    return new Promise((ok, err) => { const i = new Image(); i.onload = () => ok(i); i.onerror = () => err(new Error('Bild nicht lesbar')); i.src = src; });
  }
  async function bildVorbereiten(file, maxSeite, qualitaet) {
    const url = URL.createObjectURL(file);
    try {
      const img = await ladeBild(url);
      const s = Math.min(1, maxSeite / Math.max(img.naturalWidth, img.naturalHeight));
      const w = Math.round(img.naturalWidth * s), hh = Math.round(img.naturalHeight * s);
      const c = document.createElement('canvas'); c.width = w; c.height = hh;
      const ctx = c.getContext('2d'); ctx.fillStyle = '#fff'; ctx.fillRect(0, 0, w, hh); ctx.drawImage(img, 0, 0, w, hh);
      const blob = await new Promise(r => c.toBlob(r, 'image/jpeg', qualitaet));
      const bytes = new Uint8Array(await blob.arrayBuffer());
      return { bytes, w, h: hh, url: URL.createObjectURL(blob) };
    } finally { URL.revokeObjectURL(url); }
  }

  function unterschriftFeld(canvas, beiStrich) {
    const ctx = canvas.getContext('2d'); let malt = false, last = null, ratio = 1;
    function groesse() {
      ratio = window.devicePixelRatio || 1;
      const r = canvas.getBoundingClientRect();
      canvas.width = Math.round(r.width * ratio); canvas.height = Math.round(r.height * ratio);
      leeren();
    }
    function leeren() { ctx.fillStyle = '#fff'; ctx.fillRect(0, 0, canvas.width, canvas.height); }
    const pos = e => { const r = canvas.getBoundingClientRect(); return [(e.clientX - r.left) * ratio, (e.clientY - r.top) * ratio]; };
    canvas.addEventListener('pointerdown', e => { malt = true; last = pos(e); canvas.setPointerCapture(e.pointerId); e.preventDefault(); });
    canvas.addEventListener('pointermove', e => {
      if (!malt) return; const p = pos(e);
      ctx.strokeStyle = '#0a2a6b'; ctx.lineWidth = 2.6 * ratio; ctx.lineCap = 'round'; ctx.lineJoin = 'round';
      ctx.beginPath(); ctx.moveTo(...last); ctx.lineTo(...p); ctx.stroke(); last = p; beiStrich(); e.preventDefault();
    });
    ['pointerup', 'pointercancel', 'pointerleave'].forEach(t => canvas.addEventListener(t, () => malt = false));
    window.addEventListener('resize', () => { if (document.body.contains(canvas)) groesse(); });
    async function alsJpeg() {
      const blob = await new Promise(r => canvas.toBlob(r, 'image/jpeg', 0.9));
      return { bytes: new Uint8Array(await blob.arrayBuffer()), w: canvas.width, h: canvas.height };
    }
    return { groesse, leeren, alsJpeg };
  }

  // ---------- PDF ----------
  function bauePdF(d, fotos, sig) {
    const doc = new MiniPDF.Doc(); doc.addPage();
    const L = 40, R = 555, W = R - L;
    const GRUEN = [0.12, 0.56, 0.31], ROT = [0.78, 0.16, 0.16], GRAU = [0.42, 0.45, 0.5], HELL = [0.95, 0.96, 0.97];
    const MARKE = [0.345, 0.694, 0.2];
    doc.rect(0, 0, 595, 8, MARKE);
    doc.text(L, 52, 'Fahrzeugkontrolle', 20, true, MARKE);
    doc.textRight(R, 52, 'ViamedGO Bonn', 10, false, GRAU);
    doc.line(L, 62, R, 62, 1);

    // Kopf
    const kopfFelder = [
      ['Kennzeichen', d.kennzeichen], ['Datum', deDatum(d.datum) + ', ' + d.uhrzeit + ' Uhr'], ['KW', String(d.kw)],
      ['KM-Stand', d.kmStand.toLocaleString('de-DE')], ['TÜV / HU', d.tuevHu || '–'], ['Nächster Service', d.naechsterServiceKm ? kmText(d.naechsterServiceKm) + (d.serviceFaellig ? ' – FÄLLIG' : '') : '–'],
      ['Reifen', d.reifenArt || '–'], ['Prüfer', d.pruefer], ['Mängel', String(d.maengel.length)],
      ['Fahrer', d.fahrer || '–'], ['Führerschein dabei', d.fuehrerscheinDabei ? 'Ja' : 'Nein'], ['Foto Führerschein', d.fuehrerscheinFoto ? 'Ja (siehe Fotos)' : 'Nein']
    ];
    let y = 74; const cw = W / 3;
    kopfFelder.forEach(([k, v], i) => {
      const x = L + (i % 3) * cw, yy = y + Math.floor(i / 3) * 34;
      doc.rect(x + 1, yy, cw - 2, 30, HELL);
      doc.text(x + 8, yy + 11, k, 7.5, false, GRAU);
      doc.text(x + 8, yy + 25, v, k === 'Kennzeichen' ? 13 : 10.5, true, (k === 'Mängel' && d.maengel.length) || (k === 'Nächster Service' && d.serviceFaellig) || (k === 'Führerschein dabei' && !d.fuehrerscheinDabei) ? ROT : null);
    });
    y += Math.ceil(kopfFelder.length / 3) * 34 + 14;

    // Reifen
    doc.text(L, y, 'Profiltiefe / Reifendruck', 10, true); y += 8;
    const rw = W / 4;
    RAEDER.forEach(([k, name], i) => {
      const r = d.reifen[k], x = L + i * rw;
      doc.rect(x + 1, y, rw - 2, 26, HELL);
      doc.text(x + 8, y + 10, name, 7.5, false, GRAU);
      doc.text(x + 8, y + 22, `${r.profilMm != null ? String(r.profilMm).replace('.', ',') + ' mm' : '– mm'}   ${r.druckBar != null ? String(r.druckBar).replace('.', ',') + ' bar' : '– bar'}`, 10, true);
    });
    y += 40;

    // Prüfpunkte, zwei Spalten
    const col = W / 2 - 8;
    function spalte(namen, x, y0) {
      let yy = y0;
      namen.forEach(n => {
        const p = d.punkte.find(q => q.punkt === n);
        const farbe = p.status === 'i.O.' ? GRUEN : p.status === 'Mangel' ? ROT : GRAU;
        doc.text(x, yy + 11, n, 9.5);
        doc.textRight(x + col, yy + 11, p.status === 'entfällt' ? '–' : p.status, 9.5, true, farbe);
        yy += 15;
        if (p.notiz) { doc.wrap(p.notiz, 8, col - 10).forEach(l => { doc.text(x + 10, yy + 7, l, 8, false, ROT); yy += 10; }); }
        doc.line(x, yy + 1, x + col, yy + 1, 0.3, 0.8); yy += 4;
      });
      return yy;
    }
    doc.text(L, y, 'Technik und Zustand', 10, true); doc.text(L + col + 16, y, 'Ausstattung und Flüssigkeiten', 10, true);
    y += 4;
    y = Math.max(spalte(PUNKTE_LINKS, L, y), spalte(PUNKTE_RECHTS, L + col + 16, y)) + 14;

    // Sonstiges
    doc.text(L, y, 'Sonstiges', 10, true); y += 6;
    const sonst = d.sonstiges ? doc.wrap(d.sonstiges, 9.5, W - 16) : ['–'];
    const sh = Math.max(34, sonst.length * 12 + 12);
    doc.rect(L, y, W, sh, HELL);
    sonst.forEach((l, i) => doc.text(L + 8, y + 15 + i * 12, l, 9.5));
    y += sh + 16;

    // Bestätigung
    if (y > 700) { doc.addPage(); y = 60; }
    doc.wrap(BESTAETIGUNG, 9, W).forEach(l => { doc.text(L, y, '[x] ' + l, 9); y += 12; });
    y += 8;
    const sh2 = 60, sw = Math.min(220, sig.w / sig.h * sh2);
    doc.image(sig, R - sw, y, sw, sh2);
    doc.text(L, y + 40, d.pruefer, 12, true);
    doc.line(L, y + sh2 + 4, L + 220, y + sh2 + 4, 0.5); doc.line(R - 220, y + sh2 + 4, R, y + sh2 + 4, 0.5);
    doc.text(L, y + sh2 + 15, 'Kontrolle durchgeführt von', 7.5, false, GRAU);
    doc.text(R - 220, y + sh2 + 15, 'Unterschrift', 7.5, false, GRAU);

    // Fotoseiten, zwei Fotos je Seite
    fotos.forEach((f, i) => {
      if (i % 2 === 0) { doc.addPage(); doc.text(L, 45, `Fotos ${d.kennzeichen} – ${deDatum(d.datum)}`, 12, true); }
      const top = i % 2 === 0 ? 62 : 452, maxH = 360, maxW = W;
      const s = Math.min(maxW / f.w, maxH / f.h), dw = f.w * s, dh = f.h * s;
      doc.text(L, top + 10, `Foto ${i + 1}: ${f.art}`, 9.5, true, GRAU);
      doc.image(f, L + (W - dw) / 2, top + 16, dw, dh);
    });
    // Seitenzahlen
    doc.pages.forEach((p, i) => { doc.cur = p; doc.textRight(R, 820, `Seite ${i + 1} von ${doc.pages.length}`, 7.5, false, GRAU); doc.text(L, 820, `${d.kennzeichen} · ${deDatum(d.datum)}`, 7.5, false, GRAU); });
    return doc.output();
  }

  // ---------- Start ----------
  if ('serviceWorker' in navigator && (location.protocol === 'https:' || location.hostname === 'localhost')) {
    navigator.serviceWorker.register('sw.js').catch(() => {});
  }
  window.FK = { baueTestPdf: () => baueTestPdf() };
  function baueTestPdf() {
    const d = { kennzeichen: 'BN-VM-100', datum: isoDatum(new Date()), uhrzeit: '12:00', kw: kw(new Date()), kmStand: 160683, tuevHu: '12/27', naechsterServiceKm: 160000, serviceFaellig: true, reifenArt: 'Winter', pruefer: 'Prüfer Test', fahrer: 'Fahrer Test', fuehrerscheinDabei: true, fuehrerscheinFoto: true, reifen: { VL: { profilMm: 6.5, druckBar: 2.4 }, VR: { profilMm: 6, druckBar: 2.4 }, HL: { profilMm: null, druckBar: null }, HR: { profilMm: 5, druckBar: 2.6 } }, punkte: PUNKTE.map((p, i) => ({ punkt: p, status: i === 1 ? 'Mangel' : i === 4 ? 'entfällt' : 'i.O.', notiz: i === 1 ? 'Gurt hinten rechts rollt schwer zurück' : '' })), sonstiges: 'Kratzer an der Schiebetür links. Ölstand knapp über Minimum, nachfüllen.', maengel: ['Service fällig', 'Alle Gurte i.O.: Gurt hinten rechts'] };
    const c = document.createElement('canvas'); c.width = 400; c.height = 120; const x = c.getContext('2d'); x.fillStyle = '#fff'; x.fillRect(0, 0, 400, 120); x.strokeStyle = '#0a2a6b'; x.lineWidth = 3; x.beginPath(); x.moveTo(20, 90); x.bezierCurveTo(80, 10, 140, 110, 200, 40); x.bezierCurveTo(260, 0, 300, 100, 380, 50); x.stroke();
    return new Promise(r => c.toBlob(async b => { const sig = { bytes: new Uint8Array(await b.arrayBuffer()), w: 400, h: 120 }; r(bauePdF(d, [Object.assign({}, sig, { art: 'Vorne' })], sig)); }, 'image/jpeg', 0.9));
  }
  zeigeStart();
})();
