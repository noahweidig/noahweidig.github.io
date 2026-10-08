/**
 * The tools shown on the homepage preview and the /tech page. `icon` is a file
 * stem in `public/media/icons/tech/`; every mark there is single-color and is
 * drawn as a mask, so it takes the page's text color in either theme.
 */
export interface Tool {
  name: string;
  icon: string;
  /** Shown in the homepage preview. */
  featured?: boolean;
}

export const techCategories: { name: string; tools: Tool[] }[] = [
  {
    name: 'Languages',
    tools: [
      { name: 'R', icon: 'r', featured: true },
      { name: 'Python', icon: 'python', featured: true },
      { name: 'JavaScript', icon: 'javascript', featured: true },
      { name: 'SQL', icon: 'sql', featured: true },
      { name: 'Markdown', icon: 'markdown' },
      { name: 'LaTeX', icon: 'latex' },
      { name: 'HTML', icon: 'html' },
      { name: 'CSS', icon: 'css' },
    ],
  },
  {
    name: 'Data',
    tools: [
      { name: 'tidyverse', icon: 'tidyverse' },
      { name: 'pandas', icon: 'pandas' },
      { name: 'NumPy', icon: 'numpy' },
      { name: 'Plotly', icon: 'plotly' },
      { name: 'Conda', icon: 'conda' },
    ],
  },
  {
    name: 'Geospatial',
    tools: [
      { name: 'ArcGIS Pro', icon: 'arcgis', featured: true },
      { name: 'GEE', icon: 'gee', featured: true },
      { name: 'QGIS', icon: 'qgis', featured: true },
      { name: 'GDAL', icon: 'gdal', featured: true },
      { name: 'sf', icon: 'sf' },
      { name: 'terra', icon: 'terra' },
      { name: 'GeoPandas', icon: 'geopandas' },
      { name: 'OSM', icon: 'osm' },
    ],
  },
  {
    name: 'Workflow',
    tools: [
      { name: 'Git', icon: 'git', featured: true },
      { name: 'GitHub', icon: 'github' },
      { name: 'Actions', icon: 'actions' },
    ],
  },
  {
    name: 'AI coding',
    tools: [
      { name: 'Claude Code', icon: 'claude-code', featured: true },
      { name: 'Codex', icon: 'codex', featured: true },
      { name: 'Copilot', icon: 'copilot' },
      { name: 'Cursor', icon: 'cursor' },
      { name: 'Antigravity', icon: 'antigravity' },
      { name: 'Jules', icon: 'jules' },
    ],
  },
];

export const allTools = techCategories.flatMap((c) =>
  c.tools.map((t) => ({ ...t, category: c.name })),
);

export const featuredTools = allTools.filter((t) => t.featured);
