// Shared free-text classifiers for the fermented-beverages research fields.
// The underlying columns are rich free text ("Glutinous rice (Oryza sativa);
// fermented with wild yeast"), not a clean enum -- bucket by keyword into a
// handful of canonical categories so charts and the record profile agree on
// the same vocabulary.

export function classifyCarbSource(value) {
  if (!value) return null
  const v = value.toLowerCase()
  if (v.includes('rice') || v.includes('oryza')) return 'Rice'
  if (v.includes('millet') || v.includes('barley') || v.includes('maize') || v.includes('corn')) return 'Millet / grain'
  if (v.includes('palm sap') || v.includes('palm sugar') || v.includes('toddy') || v.includes('sap')) return 'Palm sap'
  if (v.includes('milk') || v.includes('lactose')) return 'Milk / dairy'
  if (v.includes('fruit') || v.includes('apple') || v.includes('cashew') || v.includes('apricot') || v.includes('sugarcane') || v.includes('molasses') || v.includes('sugar')) return 'Fruit / sugar'
  return 'Other'
}

export function classifyMicrobialGroup(value) {
  if (!value) return null
  const v = value.toLowerCase()
  const hasYeast = v.includes('yeast')
  const hasLab = v.includes('lab') || v.includes('lactic')
  const hasMold = v.includes('mold')
  if (hasMold && (hasYeast || hasLab)) return 'Mold-yeast-LAB mixed'
  if (hasYeast && hasLab) return 'Yeast + LAB'
  if (hasYeast) return 'Yeast-dominant'
  if (hasLab) return 'LAB-dominant'
  return 'Other / mixed'
}

export function classifyEndProduct(value) {
  if (!value) return null
  const v = value.toLowerCase()
  const hasEthanol = v.includes('ethanol')
  const hasLactic = v.includes('lactic')
  if (hasEthanol && hasLactic) return 'Ethanol + lactic acid'
  if (hasEthanol) return 'Ethanol-dominant'
  if (hasLactic) return 'Lactic acid-dominant'
  return 'Other / mixed'
}

// Maps free-text severity/confidence fields ("High", "Low–Moderate", "High
// without documentation", "Moderate; requires more study") to a coarse
// 3-level scale for gauges. Order matters: check the strongest signal first.
export function parseSeverityLevel(value) {
  if (!value) return null
  const v = value.toLowerCase()
  if (v.includes('very high')) return { label: 'Very high', level: 'high', pct: 100 }
  if (v.includes('high')) return { label: 'High', level: 'high', pct: 85 }
  if (v.includes('moderate') || v.includes('medium')) return { label: 'Moderate', level: 'moderate', pct: 55 }
  if (v.includes('low')) return { label: 'Low', level: 'low', pct: 20 }
  return null
}
