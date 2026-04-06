export const CATEGORY_ICONS = {
  burger: '🍔',
  chicken: '🍗',
  sides: '🍟',
  drinks: '🥤',
  combo: '🍱',
  dessert: '🍦',
  snacks: '🧆',
  other: '🍽️',
}

export function getMenuItemIcon(item) {
  return item?.emoji || CATEGORY_ICONS[(item?.category || '').toLowerCase()] || '🍽️'
}
