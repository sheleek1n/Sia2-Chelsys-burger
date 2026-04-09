import { getMenuItemIcon } from '@/utils/menuItemIcons'

/**
 * Renders an <img> if item.image is set, otherwise falls back to the emoji icon.
 * size: Tailwind size classes e.g. "w-16 h-16"
 * emojiSize: Tailwind text class e.g. "text-4xl"
 */
export default function MenuItemImage({ item, size = 'w-16 h-16', emojiSize = 'text-4xl' }) {
  if (item?.image) {
    return (
      <img
        src={item.image}
        alt={item.name || ''}
        className={`${size} object-cover rounded-lg`}
        onError={(e) => { e.target.style.display = 'none' }}
      />
    )
  }
  return <span className={`${emojiSize} leading-none`}>{getMenuItemIcon(item)}</span>
}
