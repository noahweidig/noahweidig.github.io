/* The subset of icons.ts that client scripts need as strings (iconSvg in
   src/client/icon.ts). Add an entry here, copied from icons.ts, to use another. */
export const scriptIcons: Record<string, { viewBox: string; body: string; stroke?: boolean }> = {
  close: { viewBox: '0 0 24 24', body: '<path d="M18 6 6 18M6 6l12 12"/>', stroke: true },
  check: { viewBox: '0 0 24 24', body: '<path d="M20 6 9 17l-5-5"/>', stroke: true },
  copy: {
    viewBox: '0 0 24 24',
    body: '<rect width="14" height="14" x="8" y="8" rx="2" ry="2"/><path d="M4 16c-1.1 0-2-.9-2-2V4c0-1.1.9-2 2-2h10c1.1 0 2 .9 2 2"/>',
    stroke: true,
  },
  pilcrow: {
    viewBox: '0 0 24 24',
    body: '<path d="M13 4v16M17 4v16M19 4H9.5a4.5 4.5 0 0 0 0 9H13"/>',
    stroke: true,
  },
  left: { viewBox: '0 0 24 24', body: '<path d="m15 18-6-6 6-6"/>', stroke: true },
  right: { viewBox: '0 0 24 24', body: '<path d="m9 18 6-6-6-6"/>', stroke: true },
  layers: {
    viewBox: '0 0 24 24',
    body: '<path d="M12.83 2.18a2 2 0 0 0-1.66 0L2.6 6.08a1 1 0 0 0 0 1.83l8.58 3.91a2 2 0 0 0 1.66 0l8.58-3.9a1 1 0 0 0 0-1.83z"/><path d="M2 12a1 1 0 0 0 .58.91l8.6 3.91a2 2 0 0 0 1.65 0l8.58-3.9A1 1 0 0 0 22 12"/><path d="M2 17a1 1 0 0 0 .58.91l8.6 3.91a2 2 0 0 0 1.65 0l8.58-3.9A1 1 0 0 0 22 17"/>',
    stroke: true,
  },
  book: {
    viewBox: '0 0 24 24',
    body: '<path d="M12 5v16m8.001-2A2 2 0 0 0 22 17V5a2 2 0 0 0-1.999-2L16 3.002A5 5 0 0 0 12 5a5 5 0 0 0-4-2H4a2 2 0 0 0-2 2v12a2 2 0 0 0 1.999 2H8a5 5 0 0 1 4 2 5 5 0 0 1 4-2z"/>',
    stroke: true,
  },
  trophy: {
    viewBox: '0 0 24 24',
    body: '<path d="M10 14.66V17a1 1 0 0 1-1 1 2 2 0 0 0-2 2v2m7-7.34V17a1 1 0 0 0 1 1 2 2 0 0 1 2 2v2m.916-12H19.5A2.5 2.5 0 0 0 22 7.5V5a1 1 0 0 0-1-1h-3M4 22h16"/><path d="M6 9a6 6 0 0 0 12 0V3a1 1 0 0 0-1-1H7a1 1 0 0 0-1 1z"/><path d="M6.084 10H4.5A2.5 2.5 0 0 1 2 7.5V5a1 1 0 0 1 1-1h3"/>',
    stroke: true,
  },
  briefcase: {
    viewBox: '0 0 24 24',
    body: '<path d="M12 12h.01M16 6V4a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v2m14 7a18.15 18.15 0 0 1-20 0"/><rect width="20" height="14" x="2" y="6" rx="2"/>',
    stroke: true,
  },
  school: {
    viewBox: '0 0 24 24',
    body: '<path d="M14 21v-3a2 2 0 0 0-4 0v3m8-16.067V21M4 6l7.106-3.79a2 2 0 0 1 1.788 0L20 6"/><path d="m6 11-3.52 2.147a1 1 0 0 0-.48.854V19a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-5a1 1 0 0 0-.48-.853L18 11M6 4.933V21"/><circle cx="12" cy="9" r="2"/>',
    stroke: true,
  },
  file: {
    viewBox: '0 0 24 24',
    body: '<path d="M6 22a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h8a2.4 2.4 0 0 1 1.704.706l3.588 3.588A2.4 2.4 0 0 1 20 8v12a2 2 0 0 1-2 2z"/><path d="M14 2v5a1 1 0 0 0 1 1h5M10 9H8m8 4H8m8 4H8"/>',
    stroke: true,
  },
};
