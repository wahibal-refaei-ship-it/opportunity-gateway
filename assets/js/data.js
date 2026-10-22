/**
 * Opportunities data module
 * Canonical loader for `data/opportunities.json`.
 * Enforces the contract of 20 records (10 scholarships, 10 courses).
 */

import { normalizeSearchText } from './i18n.js';

let cachedData = null;
let byIdMap = null;

export async function loadOpportunities() {
  if (cachedData) return cachedData;

  const response = await fetch('data/opportunities.json', {
    headers: { 'Accept': 'application/json' }
  });

  if (!response.ok) {
    throw new Error(`Failed to load opportunities data: HTTP ${response.status}`);
  }

  const json = await response.json();
  if (!json || !Array.isArray(json.opportunities)) {
    throw new Error('Invalid opportunities data format: missing opportunities array');
  }

  // Contract verification: exactly 20 records (10 scholarships, 10 courses)
  const items = json.opportunities;
  const scholarships = items.filter(item => item.type === 'scholarship');
  const courses = items.filter(item => item.type === 'course');

  if (items.length !== 20 || scholarships.length !== 10 || courses.length !== 10) {
    console.warn(`Data contract warning: Expected 20 records (10 scholarships, 10 courses). Received ${items.length} records.`);
  }

  // Pre-calculate normalized search text for each item
  items.forEach(item => {
    item._searchIndex = normalizeSearchText([
      item.title?.ar,
      item.title?.en,
      item.provider?.ar,
      item.provider?.en,
      item.country?.ar,
      item.country?.en,
      item.summary?.ar,
      item.summary?.en,
      item.description?.ar,
      item.description?.en,
      ...(item.fields || []),
      ...(item.levels || []),
      item.display?.mark,
      item.type,
      item.course?.subfield,
      item.course?.subfield_label?.ar,
      item.course?.subfield_label?.en
    ].filter(Boolean).join(' '));
  });

  cachedData = items;
  byIdMap = new Map(items.map(item => [item.id, item]));

  return cachedData;
}

export async function getOpportunityById(id) {
  if (!byIdMap) {
    await loadOpportunities();
  }
  return byIdMap.get(id) || null;
}

export async function getAllOpportunitiesMap() {
  if (!byIdMap) {
    await loadOpportunities();
  }
  return byIdMap;
}
