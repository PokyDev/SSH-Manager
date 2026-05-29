import React from 'react';

const ANSI_FG = {
  30: '#4e4e4e',
  31: '#ff6b6b',
  32: '#98c379',
  33: '#e5c07b',
  34: '#61afef',
  35: '#c678dd',
  36: '#56b6c2',
  37: '#abb2bf',
  90: '#636363',
  91: '#ff8787',
  92: '#b5e89d',
  93: '#f0d9a0',
  94: '#82aaff',
  95: '#d6a8f0',
  96: '#7ee8e8',
  97: '#ffffff',
};

function ansi256Color(n) {
  if (n < 8) return ANSI_FG[30 + n];
  if (n < 16) return ANSI_FG[90 + n - 8];
  if (n < 232) {
    const b = (n - 16) % 6;
    const g = Math.floor((n - 16) / 6) % 6;
    const r = Math.floor((n - 16) / 36);
    const toHex = (v) => {
      const val = v === 0 ? 0 : 55 + v * 40;
      return val.toString(16).padStart(2, '0');
    };
    return `#${toHex(r)}${toHex(g)}${toHex(b)}`;
  }
  const v = 8 + (n - 232) * 10;
  const hex = v.toString(16).padStart(2, '0');
  return `#${hex}${hex}${hex}`;
}

export function parseAnsiSegments(text) {
  const segments = [];
  let currentStyle = {};
  let currentText = '';
  let i = 0;

  const flush = () => {
    if (currentText) {
      segments.push({ text: currentText, style: { ...currentStyle } });
      currentText = '';
    }
  };

  while (i < text.length) {
    if (text.charCodeAt(i) === 0x1b && i + 1 < text.length && text.charCodeAt(i + 1) === 0x5b) {
      flush();
      let j = i + 2;
      while (
        j < text.length &&
        ((text.charCodeAt(j) >= 0x30 && text.charCodeAt(j) <= 0x39) || text.charCodeAt(j) === 0x3b)
      ) {
        j++;
      }
      if (j < text.length && text.charCodeAt(j) === 0x6d) {
        const paramStr = text.slice(i + 2, j);
        const params = paramStr ? paramStr.split(';').map(Number) : [0];
        for (let k = 0; k < params.length; k++) {
          const p = params[k];
          if (p === 0) currentStyle = {};
          else if (p === 1) currentStyle.bold = true;
          else if (p === 2) currentStyle.dim = true;
          else if (p >= 30 && p <= 37) currentStyle.color = ANSI_FG[p];
          else if (p >= 90 && p <= 97) currentStyle.color = ANSI_FG[p];
          else if (p === 38 && params[k + 1] === 5 && params[k + 2] != null) {
            currentStyle.color = ansi256Color(params[k + 2]);
            k += 2;
          } else if (p === 38 && params[k + 1] === 2 && params[k + 4] != null) {
            currentStyle.color = `rgb(${params[k + 2]},${params[k + 3]},${params[k + 4]})`;
            k += 4;
          }
        }
        i = j + 1;
      } else {
        currentText += text[i];
        i++;
      }
    } else {
      currentText += text[i];
      i++;
    }
  }

  flush();
  return segments;
}

export default function AnsiText({ text }) {
  const segments = parseAnsiSegments(text);
  if (segments.length === 1 && !Object.keys(segments[0].style).length) {
    return segments[0].text;
  }
  return segments.map((seg, i) => {
    const style = {};
    if (seg.style.color) style.color = seg.style.color;
    if (seg.style.bold) style.fontWeight = 'bold';
    if (seg.style.dim) style.opacity = '0.6';
    return React.createElement('span', { key: i, style }, seg.text);
  });
}
