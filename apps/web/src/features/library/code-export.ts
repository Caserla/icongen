export const codeTargets = ['SVG', 'Vue', 'React', 'HTML', 'Svelte', 'Web Components'] as const;
export type CodeTarget = typeof codeTargets[number];

// Input is the validated renderer output, never arbitrary user HTML.
export function exportCode(svg: string, target: CodeTarget) {
  if (!svg) return '';
  const formatted = svg.replace(/></g, '>\n<');
  if (target === 'Vue') return `<template>\n${formatted}\n</template>\n`;
  if (target === 'React') {
    const jsx = formatted.replace(/\b(stroke-width|stroke-linecap|stroke-linejoin|fill-rule|stop-color)=/g, attribute => ({'stroke-width=':'strokeWidth=','stroke-linecap=':'strokeLinecap=','stroke-linejoin=':'strokeLinejoin=','fill-rule=':'fillRule=','stop-color=':'stopColor='}[attribute]!));
    return `export default function Icon() {\n  return (\n${jsx}\n  );\n}\n`;
  }
  if (target === 'Web Components') return `class EasyIcon extends HTMLElement {\n  connectedCallback() {\n    if (!this.shadowRoot) this.attachShadow({ mode: 'open' }).innerHTML = ${JSON.stringify(svg)};\n  }\n}\nif (!customElements.get('easy-icon')) customElements.define('easy-icon', EasyIcon);\n`;
  return formatted;
}
