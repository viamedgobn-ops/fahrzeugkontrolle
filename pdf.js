// Kleiner PDF-Schreiber ohne fremde Bibliothek: Text (Helvetica, WinAnsi), Linien, Flächen, JPEG-Bilder.
// Koordinaten: Ursprung oben links, Einheit pt, Seite A4 (595 x 842).
(function () {
  const PAGE_W = 595, PAGE_H = 842;
  const WIN = { 0x20AC: 0x80, 0x201A: 0x82, 0x201E: 0x84, 0x2026: 0x85, 0x2022: 0x95, 0x2013: 0x96, 0x2014: 0x97, 0x2018: 0x91, 0x2019: 0x92, 0x201C: 0x93, 0x201D: 0x94 };

  function toWin(str) {
    let out = '';
    for (const ch of String(str)) {
      const c = ch.codePointAt(0);
      if (c === 10 || c === 13) out += ' ';
      else if (c < 128 || (c >= 0xA0 && c <= 0xFF)) out += String.fromCharCode(c);
      else if (WIN[c]) out += String.fromCharCode(WIN[c]);
      else out += '?';
    }
    return out;
  }
  function esc(str) { return toWin(str).replace(/[\\()]/g, m => '\\' + m); }
  function latin1(s) { const b = new Uint8Array(s.length); for (let i = 0; i < s.length; i++) b[i] = s.charCodeAt(i) & 255; return b; }
  const f = n => (Math.round(n * 100) / 100).toString();

  // grobe Helvetica-Breiten (je 1000 Einheiten) für Zeilenumbruch
  function charW(c) {
    if (' ilI.,:;|!\'jtf'.includes(c)) return 280;
    if ('rJ()-[]/'.includes(c)) return 333;
    if ('mwMW'.includes(c)) return 860;
    if (c >= 'A' && c <= 'Z' || 'ÄÖÜ'.includes(c)) return 680;
    return 556;
  }
  function textWidth(s, size) { let w = 0; for (const c of String(s)) w += charW(c); return w * size / 1000; }

  class Doc {
    constructor() { this.pages = []; this.images = []; this.cur = null; }
    addPage() { this.cur = { ops: [] }; this.pages.push(this.cur); }
    text(x, y, s, size = 10, bold = false, color) {
      const c = color ? `${color.join(' ')} rg ` : '';
      this.cur.ops.push(`BT ${c}/${bold ? 'F2' : 'F1'} ${size} Tf ${f(x)} ${f(PAGE_H - y)} Td (${esc(s)}) Tj ET${color ? ' 0 g' : ''}`);
    }
    textRight(xRight, y, s, size = 10, bold = false, color) { this.text(xRight - textWidth(s, size), y, s, size, bold, color); }
    wrap(s, size, maxW) {
      const lines = [];
      for (const para of String(s).split(/\n/)) {
        let line = '';
        for (const word of para.split(/\s+/)) {
          const t = line ? line + ' ' + word : word;
          if (textWidth(t, size) > maxW && line) { lines.push(line); line = word; } else line = t;
        }
        lines.push(line);
      }
      return lines;
    }
    line(x1, y1, x2, y2, w = 0.5, gray = 0) {
      this.cur.ops.push(`${gray} G ${f(w)} w ${f(x1)} ${f(PAGE_H - y1)} m ${f(x2)} ${f(PAGE_H - y2)} l S 0 G`);
    }
    rect(x, y, w, h, fill, stroke) {
      if (fill) this.cur.ops.push(`${fill.join(' ')} rg ${f(x)} ${f(PAGE_H - y - h)} ${f(w)} ${f(h)} re f 0 g`);
      if (stroke) this.cur.ops.push(`0.5 w ${stroke} G ${f(x)} ${f(PAGE_H - y - h)} ${f(w)} ${f(h)} re S 0 G`);
    }
    image(img, x, y, dw, dh) {
      let idx = this.images.indexOf(img);
      if (idx < 0) { this.images.push(img); idx = this.images.length - 1; }
      this.cur.ops.push(`q ${f(dw)} 0 0 ${f(dh)} ${f(x)} ${f(PAGE_H - y - dh)} cm /Im${idx + 1} Do Q`);
    }
    output() {
      const parts = []; let pos = 0; const offs = [];
      const push = p => { parts.push(p); pos += p.length; };
      const obj = (n, body) => { offs[n] = pos; push(`${n} 0 obj\n${body}\nendobj\n`); };
      const nImg = this.images.length, first = 5 + nImg;
      const pageIds = this.pages.map((_, i) => first + i * 2);
      push('%PDF-1.4\n%\xE2\xE3\xCF\xD3\n');
      obj(1, '<< /Type /Catalog /Pages 2 0 R >>');
      obj(2, `<< /Type /Pages /Kids [${pageIds.map(i => i + ' 0 R').join(' ')}] /Count ${pageIds.length} >>`);
      obj(3, '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>');
      obj(4, '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold /Encoding /WinAnsiEncoding >>');
      this.images.forEach((im, i) => {
        const n = 5 + i; offs[n] = pos;
        push(`${n} 0 obj\n<< /Type /XObject /Subtype /Image /Width ${im.w} /Height ${im.h} /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /DCTDecode /Length ${im.bytes.length} >>\nstream\n`);
        push(im.bytes); push('\nendstream\nendobj\n');
      });
      const xobj = this.images.map((_, i) => `/Im${i + 1} ${5 + i} 0 R`).join(' ');
      this.pages.forEach((p, i) => {
        const pid = pageIds[i], cid = pid + 1, content = p.ops.join('\n');
        obj(pid, `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${PAGE_W} ${PAGE_H}] /Resources << /Font << /F1 3 0 R /F2 4 0 R >> /XObject << ${xobj} >> >> /Contents ${cid} 0 R >>`);
        obj(cid, `<< /Length ${content.length} >>\nstream\n${content}\nendstream`);
      });
      const total = first + this.pages.length * 2, xrefPos = pos;
      let x = `xref\n0 ${total}\n0000000000 65535 f \n`;
      for (let n = 1; n < total; n++) x += String(offs[n]).padStart(10, '0') + ' 00000 n \n';
      push(x + `trailer\n<< /Size ${total} /Root 1 0 R >>\nstartxref\n${xrefPos}\n%%EOF\n`);
      return new Blob(parts.map(p => typeof p === 'string' ? latin1(p) : p), { type: 'application/pdf' });
    }
  }

  window.MiniPDF = { Doc, PAGE_W, PAGE_H, textWidth };
})();
