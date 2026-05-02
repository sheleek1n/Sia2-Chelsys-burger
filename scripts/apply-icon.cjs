// Applies the Chelsy's Burger ICO icon directly to the built exe.
// Run this after electron-builder finishes (it skips icon embedding due to
// the winCodeSign symlink limitation on this machine).
//
// Usage: node scripts/apply-icon.cjs

const { rcedit } = require('rcedit')
const path = require('path')

const EXE = path.resolve(__dirname, '..', 'release', 'win-unpacked', "Chelsy's Burger POS.exe")
const ICO = path.resolve(__dirname, '..', 'public', 'chelsys-burger-logo.ico')

console.log('Applying icon to:', EXE)
rcedit(EXE, {
  icon: ICO,
  'version-string': {
    CompanyName:      "Chelsy's Burger",
    FileDescription:  "Chelsy's Burger POS",
    ProductName:      "Chelsy's Burger POS",
    InternalName:     'chelsys-burger',
    OriginalFilename: "Chelsy's Burger POS.exe",
  },
  'file-version':    '1.0.0.0',
  'product-version': '1.0.0.0',
})
  .then(() => console.log('✅ Icon applied successfully'))
  .catch((e) => { console.error('❌ Failed:', e.message); process.exit(1) })
