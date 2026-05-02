/**
 * Proper ICO generator:
 *   1. Loads the source image with jimp (handles JPEG disguised as .png)
 *   2. Saves each size as a REAL PNG file on disk
 *   3. Feeds those real PNG paths to png-to-ico (which needs actual PNG files)
 *   4. Writes the final .ico to electron/
 *
 * Run: node scripts/make-icon.cjs
 */

const Jimp      = require('jimp')
const pngToIco  = require('png-to-ico').default
const fs        = require('fs')
const path      = require('path')
const os        = require('os')

const SRC    = path.resolve(__dirname, '..', 'public', 'chelsys-burger-logo.png')
const DEST   = path.resolve(__dirname, '..', 'electron', 'chelsys-burger-logo.ico')
const SIZES  = [256, 128, 64, 48, 32, 16]

async function main() {
  console.log('Loading source image…')
  const img = await Jimp.read(SRC)
  console.log(`  Source: ${img.bitmap.width}×${img.bitmap.height} px`)

  // Write each size to a real temp PNG file (png-to-ico needs files, not buffers)
  const tmpDir   = fs.mkdtempSync(path.join(os.tmpdir(), 'chelsys-ico-'))
  const pngPaths = []

  for (const size of SIZES) {
    const dest = path.join(tmpDir, `icon-${size}.png`)
    await img.clone().resize(size, size).writeAsync(dest)
    // Verify the written file starts with PNG magic bytes
    const magic = fs.readFileSync(dest).slice(0, 4).toString('hex')
    console.log(`  ${size}×${size} → ${dest}  magic=${magic}`)
    pngPaths.push(dest)
  }

  console.log('Building ICO…')
  const icoBuffer = await pngToIco(pngPaths)
  console.log(`  ICO size: ${(icoBuffer.length / 1024).toFixed(1)} KB`)

  // Cleanup temp files
  for (const p of pngPaths) fs.unlinkSync(p)
  fs.rmdirSync(tmpDir)

  fs.writeFileSync(DEST, icoBuffer)
  console.log('✅  Written:', DEST)
}

main().catch(e => { console.error('❌', e.message); process.exit(1) })
