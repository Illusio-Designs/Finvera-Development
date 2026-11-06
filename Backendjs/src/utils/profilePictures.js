const object = value => { if (value && typeof value === 'object') return value; try { return JSON.parse(value || '{}'); } catch { return {}; } };
function mergeProfileStats(previous, incoming) {
  const merged = { ...object(previous) };
  for (const [platform, values] of Object.entries(incoming || {})) merged[platform] = { ...object(merged[platform]), ...Object.fromEntries(Object.entries(values || {}).filter(([, value]) => value != null && value !== '')) };
  return merged;
}
module.exports = { mergeProfileStats };
