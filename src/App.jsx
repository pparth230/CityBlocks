import React, { useEffect, useMemo, useRef, useState } from 'react'

const POSTER_WIDTH = 800
const POSTER_HEIGHT = 1200
const CONTENT_FRAME_RATIO = 753 / 1100

const DEFAULTS = {
  headline: 'toner\neffect',
  footerA: 'Bits&Motion',
  textHeight: 1,
  dotSpacing: 10,
  dotSize: 0.98,
  blur: 8,
  spread: 18,
  threshold: 0.12,
  jitter: 0.9,
  softness: 1.3,
  shadowOffsetY: 16,
  shadowBlur: 26,
  texture: 0.18,
  imageContrast: 1.12,
  imageBrightness: 0.94,
  showSourceLayer: false,
}

const CONTROLS = [
  { key: 'textHeight', label: 'text height', min: 1, max: 2, step: 0.01 },
  { key: 'dotSpacing', label: 'dot spacing', min: 6, max: 16, step: 1 },
  { key: 'dotSize', label: 'dot size', min: 0.5, max: 1.4, step: 0.01 },
  { key: 'blur', label: 'blur', min: 0, max: 18, step: 1 },
  { key: 'spread', label: 'spread', min: 0, max: 36, step: 1 },
  { key: 'threshold', label: 'threshold', min: 0.02, max: 0.4, step: 0.01 },
  { key: 'jitter', label: 'jitter', min: 0, max: 2.2, step: 0.01 },
  { key: 'softness', label: 'softness', min: 0.6, max: 2.4, step: 0.01 },
  { key: 'shadowOffsetY', label: 'shadow y', min: 0, max: 32, step: 1 },
  { key: 'shadowBlur', label: 'shadow blur', min: 0, max: 40, step: 1 },
  { key: 'texture', label: 'paper texture', min: 0, max: 0.35, step: 0.01 },
  { key: 'imageContrast', label: 'image contrast', min: 0.6, max: 1.8, step: 0.01 },
  { key: 'imageBrightness', label: 'image brightness', min: 0.6, max: 1.4, step: 0.01 },
]

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value))
}

function hashNoise(x, y, seed = 0) {
  const value = Math.sin(x * 127.1 + y * 311.7 + seed * 17.13) * 43758.5453123
  return value - Math.floor(value)
}

function fitTextBlock(ctx, lines, maxWidth, maxHeight, startSize) {
  let size = startSize

  while (size > 40) {
    ctx.font = `900 ${size}px Arial Black, Helvetica, sans-serif`
    const widest = Math.max(...lines.map(line => ctx.measureText(line).width))
    const lineHeight = size * 0.82
    const height = lineHeight * lines.length

    if (widest <= maxWidth && height <= maxHeight) {
      return { size, lineHeight, widest, height }
    }

    size -= 4
  }

  return { size: 40, lineHeight: 32.8, widest: maxWidth, height: maxHeight }
}

function fitTextWidth(ctx, lines, maxWidth, startSize, lineHeightRatio = 0.82) {
  let size = startSize

  while (size > 40) {
    ctx.font = `900 ${size}px Arial Black, Helvetica, sans-serif`
    const widest = Math.max(...lines.map(line => ctx.measureText(line).width))

    if (widest <= maxWidth) {
      return {
        size,
        lineHeight: size * lineHeightRatio,
        widest,
        height: size * lineHeightRatio * lines.length,
      }
    }

    size -= 2
  }

  return {
    size: 40,
    lineHeight: 40 * lineHeightRatio,
    widest: maxWidth,
    height: 40 * lineHeightRatio * lines.length,
  }
}

function wrapTextLines(ctx, text, maxWidth) {
  const paragraphs = text
    .split('\n')
    .map(line => line.trim())
    .filter(Boolean)

  const wrapped = []

  for (const paragraph of paragraphs) {
    const words = paragraph.split(/\s+/).filter(Boolean)
    if (words.length === 0) continue

    let currentLine = words[0]

    for (let i = 1; i < words.length; i += 1) {
      const candidate = `${currentLine} ${words[i]}`
      if (ctx.measureText(candidate).width <= maxWidth) {
        currentLine = candidate
      } else {
        wrapped.push(currentLine)
        currentLine = words[i]
      }
    }

    wrapped.push(currentLine)
  }

  return wrapped.length > 0 ? wrapped : ['']
}

function getContentFrame(width, height) {
  const maxWidth = width * 0.76
  const maxHeight = height * 0.72

  let frameWidth = maxWidth
  let frameHeight = frameWidth / CONTENT_FRAME_RATIO

  if (frameHeight > maxHeight) {
    frameHeight = maxHeight
    frameWidth = frameHeight * CONTENT_FRAME_RATIO
  }

  return {
    frameWidth,
    frameHeight,
    frameX: (width - frameWidth) / 2,
    frameY: (height - frameHeight) / 2,
  }
}

function drawPaper(ctx, width, height, texture) {
  ctx.fillStyle = '#e6e3dd'
  ctx.fillRect(0, 0, width, height)

  const image = ctx.createImageData(width, height)
  const data = image.data

  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const idx = (y * width + x) * 4
      const grain = (hashNoise(x * 0.9, y * 0.9, 1) - 0.5) * 255 * texture
      const fibers = (hashNoise(x * 0.08, y * 1.2, 2) - 0.5) * 255 * texture * 0.75
      const tone = clamp(230 + grain + fibers, 212, 244)
      data[idx] = tone
      data[idx + 1] = tone
      data[idx + 2] = tone - 2
      data[idx + 3] = 255
    }
  }

  ctx.putImageData(image, 0, 0)
}

function buildTextMaskCanvas(text, settings, width, height) {
  const mask = document.createElement('canvas')
  mask.width = width
  mask.height = height
  const ctx = mask.getContext('2d')

  ctx.clearRect(0, 0, width, height)
  ctx.fillStyle = '#000'
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'

  const frame = getContentFrame(width, height)
  const baseSize = Math.round(frame.frameHeight * 0.115 * settings.textHeight)
  ctx.font = `900 ${baseSize}px Arial Black, Helvetica, sans-serif`
  const lines = wrapTextLines(ctx, text, frame.frameWidth * 0.94)
  const textBox = fitTextWidth(ctx, lines, frame.frameWidth * 0.94, baseSize)
  const centerX = frame.frameX + frame.frameWidth / 2
  const startY = frame.frameY + frame.frameHeight / 2 - (textBox.lineHeight * (lines.length - 1)) / 2

  ctx.filter = `blur(${settings.blur}px)`
  ctx.font = `900 ${textBox.size}px Arial Black, Helvetica, sans-serif`
  for (let index = 0; index < lines.length; index += 1) {
    ctx.fillText(lines[index], centerX, startY + index * textBox.lineHeight)
  }

  if (settings.spread > 0) {
    ctx.globalAlpha = 0.22
    for (let angle = 0; angle < 360; angle += 24) {
      const radians = (angle * Math.PI) / 180
      const dx = Math.cos(radians) * settings.spread
      const dy = Math.sin(radians) * settings.spread
      for (let index = 0; index < lines.length; index += 1) {
        ctx.fillText(lines[index], centerX + dx, startY + index * textBox.lineHeight + dy)
      }
    }
    ctx.globalAlpha = 1
  }

  ctx.filter = 'none'

  return { mask, textBox, lines }
}

function buildImageMaskCanvas(image, settings, width, height) {
  const mask = document.createElement('canvas')
  mask.width = width
  mask.height = height
  const ctx = mask.getContext('2d')

  ctx.clearRect(0, 0, width, height)
  const { frameWidth, frameHeight, frameX, frameY } = getContentFrame(width, height)
  const scale = Math.max(frameWidth / image.width, frameHeight / image.height)
  const drawWidth = image.width * scale
  const drawHeight = image.height * scale
  const x = frameX + (frameWidth - drawWidth) / 2
  const y = frameY + (frameHeight - drawHeight) / 2

  ctx.filter = `grayscale(1) contrast(${settings.imageContrast}) brightness(${settings.imageBrightness}) blur(${settings.blur}px)`
  ctx.save()
  ctx.beginPath()
  ctx.rect(frameX, frameY, frameWidth, frameHeight)
  ctx.clip()
  ctx.drawImage(image, x, y, drawWidth, drawHeight)

  if (settings.spread > 0) {
    ctx.globalAlpha = 0.18
    for (let angle = 0; angle < 360; angle += 30) {
      const radians = (angle * Math.PI) / 180
      const dx = Math.cos(radians) * settings.spread
      const dy = Math.sin(radians) * settings.spread
      ctx.drawImage(image, x + dx, y + dy, drawWidth, drawHeight)
    }
    ctx.globalAlpha = 1
  }
  ctx.restore()

  ctx.filter = 'none'

  const imageData = ctx.getImageData(0, 0, width, height)
  const data = imageData.data
  for (let idx = 0; idx < data.length; idx += 4) {
    const lum = (data[idx] + data[idx + 1] + data[idx + 2]) / 3
    const alpha = data[idx + 3] / 255
    const dark = (1 - lum / 255) * alpha
    const value = dark * 255
    data[idx] = value
    data[idx + 1] = value
    data[idx + 2] = value
    data[idx + 3] = value
  }
  ctx.putImageData(imageData, 0, 0)

  return {
    mask,
    frame: {
      x,
      y,
      drawWidth,
      drawHeight,
      frameX,
      frameY,
      frameWidth,
      frameHeight,
    },
  }
}

function drawToner(ctx, maskCanvas, settings, width, height) {
  const maskCtx = maskCanvas.getContext('2d')
  const image = maskCtx.getImageData(0, 0, width, height).data
  const spacing = settings.dotSpacing

  for (let y = 0; y < height; y += spacing) {
    for (let x = 0; x < width; x += spacing) {
      const sampleX = clamp(Math.round(x), 0, width - 1)
      const sampleY = clamp(Math.round(y), 0, height - 1)
      const idx = (sampleY * width + sampleX) * 4
      const alpha = image[idx + 3] / 255

      if (alpha <= settings.threshold) continue

      const normalized = clamp((alpha - settings.threshold) / (1 - settings.threshold), 0, 1)
      const radius = (spacing * 0.5) * settings.dotSize * Math.pow(normalized, settings.softness)
      const jitterX = (hashNoise(x, y, 3) - 0.5) * settings.jitter * spacing * 0.34
      const jitterY = (hashNoise(x, y, 4) - 0.5) * settings.jitter * spacing * 0.34

      ctx.beginPath()
      ctx.arc(x + jitterX, y + jitterY, Math.max(0.8, radius), 0, Math.PI * 2)
      ctx.fill()
    }
  }
}

function drawMaskShadow(ctx, maskCanvas, settings) {
  ctx.save()
  ctx.globalAlpha = 0.22
  ctx.filter = `blur(${settings.shadowBlur}px)`
  ctx.drawImage(maskCanvas, 0, settings.shadowOffsetY)
  ctx.restore()
}

function renderTonerCanvas(canvas, state, source) {
  const ctx = canvas.getContext('2d')
  const width = canvas.width
  const height = canvas.height

  drawPaper(ctx, width, height, state.texture)
  ctx.fillStyle = '#1e1e1e'

  let maskResult

  if (source.type === 'image' && source.image) {
    maskResult = buildImageMaskCanvas(source.image, state, width, height)

    if (state.showSourceLayer) {
      ctx.save()
      ctx.globalAlpha = 0.16
      ctx.filter = 'grayscale(1) contrast(1.05)'
      ctx.beginPath()
      ctx.rect(
        maskResult.frame.frameX,
        maskResult.frame.frameY,
        maskResult.frame.frameWidth,
        maskResult.frame.frameHeight
      )
      ctx.clip()
      ctx.drawImage(
        source.image,
        maskResult.frame.x,
        maskResult.frame.y,
        maskResult.frame.drawWidth,
        maskResult.frame.drawHeight
      )
      ctx.restore()
    }

    drawMaskShadow(ctx, maskResult.mask, state)
  } else {
    maskResult = buildTextMaskCanvas(state.headline, state, width, height)

    drawMaskShadow(ctx, maskResult.mask, state)

    ctx.fillStyle = '#1d1d1d'
    ctx.textAlign = 'center'
    ctx.textBaseline = 'middle'
    ctx.font = '700 30px Arial, Helvetica, sans-serif'
    ctx.fillText(state.footerA, width / 2, height - 150)
  }

  ctx.fillStyle = '#1c1c1c'
  drawToner(ctx, maskResult.mask, state, width, height)
}

function loadImageFromUrl(url) {
  return new Promise((resolve, reject) => {
    const image = new Image()
    image.onload = () => resolve(image)
    image.onerror = reject
    image.src = url
  })
}

function downloadCanvas(canvas, filename) {
  const link = document.createElement('a')
  link.download = filename
  link.href = canvas.toDataURL('image/png')
  link.click()
}

function sanitizeFilename(name) {
  return name.replace(/\.[^/.]+$/, '').replace(/[^a-z0-9-_]+/gi, '-').toLowerCase()
}

function buildCrcTable() {
  const table = new Uint32Array(256)

  for (let n = 0; n < 256; n += 1) {
    let c = n
    for (let k = 0; k < 8; k += 1) {
      c = (c & 1) ? (0xedb88320 ^ (c >>> 1)) : (c >>> 1)
    }
    table[n] = c >>> 0
  }

  return table
}

const CRC_TABLE = buildCrcTable()

function crc32(bytes) {
  let crc = 0xffffffff

  for (let i = 0; i < bytes.length; i += 1) {
    crc = CRC_TABLE[(crc ^ bytes[i]) & 0xff] ^ (crc >>> 8)
  }

  return (crc ^ 0xffffffff) >>> 0
}

function dateToDosTime(date) {
  const year = Math.max(1980, date.getFullYear())
  const dosTime =
    ((date.getHours() & 0x1f) << 11) |
    ((date.getMinutes() & 0x3f) << 5) |
    ((Math.floor(date.getSeconds() / 2)) & 0x1f)
  const dosDate =
    (((year - 1980) & 0x7f) << 9) |
    (((date.getMonth() + 1) & 0xf) << 5) |
    (date.getDate() & 0x1f)

  return { dosTime, dosDate }
}

function createZip(entries) {
  const encoder = new TextEncoder()
  const now = new Date()
  const { dosTime, dosDate } = dateToDosTime(now)
  const localParts = []
  const centralParts = []
  let offset = 0

  for (const entry of entries) {
    const nameBytes = encoder.encode(entry.name)
    const data = entry.data
    const crc = crc32(data)

    const localHeader = new Uint8Array(30 + nameBytes.length)
    const localView = new DataView(localHeader.buffer)
    localView.setUint32(0, 0x04034b50, true)
    localView.setUint16(4, 20, true)
    localView.setUint16(6, 0, true)
    localView.setUint16(8, 0, true)
    localView.setUint16(10, dosTime, true)
    localView.setUint16(12, dosDate, true)
    localView.setUint32(14, crc, true)
    localView.setUint32(18, data.length, true)
    localView.setUint32(22, data.length, true)
    localView.setUint16(26, nameBytes.length, true)
    localView.setUint16(28, 0, true)
    localHeader.set(nameBytes, 30)

    localParts.push(localHeader, data)

    const centralHeader = new Uint8Array(46 + nameBytes.length)
    const centralView = new DataView(centralHeader.buffer)
    centralView.setUint32(0, 0x02014b50, true)
    centralView.setUint16(4, 20, true)
    centralView.setUint16(6, 20, true)
    centralView.setUint16(8, 0, true)
    centralView.setUint16(10, 0, true)
    centralView.setUint16(12, dosTime, true)
    centralView.setUint16(14, dosDate, true)
    centralView.setUint32(16, crc, true)
    centralView.setUint32(20, data.length, true)
    centralView.setUint32(24, data.length, true)
    centralView.setUint16(28, nameBytes.length, true)
    centralView.setUint16(30, 0, true)
    centralView.setUint16(32, 0, true)
    centralView.setUint16(34, 0, true)
    centralView.setUint16(36, 0, true)
    centralView.setUint32(38, 0, true)
    centralView.setUint32(42, offset, true)
    centralHeader.set(nameBytes, 46)

    centralParts.push(centralHeader)
    offset += localHeader.length + data.length
  }

  const centralDirectoryOffset = offset
  let centralDirectorySize = 0
  for (const part of centralParts) centralDirectorySize += part.length

  const endRecord = new Uint8Array(22)
  const endView = new DataView(endRecord.buffer)
  endView.setUint32(0, 0x06054b50, true)
  endView.setUint16(4, 0, true)
  endView.setUint16(6, 0, true)
  endView.setUint16(8, entries.length, true)
  endView.setUint16(10, entries.length, true)
  endView.setUint32(12, centralDirectorySize, true)
  endView.setUint32(16, centralDirectoryOffset, true)
  endView.setUint16(20, 0, true)

  return new Blob([...localParts, ...centralParts, endRecord], { type: 'application/zip' })
}

async function canvasToPngBytes(canvas) {
  const blob = await new Promise(resolve => canvas.toBlob(resolve, 'image/png'))
  const buffer = await blob.arrayBuffer()
  return new Uint8Array(buffer)
}

function downloadBlob(blob, filename) {
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.download = filename
  link.href = url
  link.click()
  window.setTimeout(() => URL.revokeObjectURL(url), 1000)
}

export default function App() {
  const canvasRef = useRef(null)
  const dragRef = useRef({
    active: false,
    startX: 0,
    startY: 0,
    originX: 0,
    originY: 0,
  })
  const [mode, setMode] = useState('text')
  const [state, setState] = useState(DEFAULTS)
  const [uploads, setUploads] = useState([])
  const [selectedId, setSelectedId] = useState(null)
  const [isBulkDownloading, setIsBulkDownloading] = useState(false)
  const [panelPosition, setPanelPosition] = useState({ x: 0, y: 28 })

  const selectedUpload = useMemo(
    () => uploads.find(item => item.id === selectedId) || uploads[0] || null,
    [uploads, selectedId]
  )

  const previewValues = useMemo(
    () => CONTROLS.map(control => ({ ...control, value: state[control.key] })),
    [state]
  )

  useEffect(() => {
    if (!canvasRef.current) return

    const source =
      mode === 'image' && selectedUpload?.image
        ? { type: 'image', image: selectedUpload.image }
        : { type: 'text' }

    renderTonerCanvas(canvasRef.current, state, source)
  }, [state, mode, selectedUpload])

  useEffect(() => {
    function handleMove(event) {
      if (!dragRef.current.active) return

      const nextX = dragRef.current.originX + (event.clientX - dragRef.current.startX)
      const nextY = dragRef.current.originY + (event.clientY - dragRef.current.startY)
      setPanelPosition({
        x: Math.max(-40, Math.min(window.innerWidth - 380, nextX)),
        y: Math.max(24, nextY),
      })
    }

    function handleUp() {
      dragRef.current.active = false
    }

    window.addEventListener('mousemove', handleMove)
    window.addEventListener('mouseup', handleUp)

    return () => {
      window.removeEventListener('mousemove', handleMove)
      window.removeEventListener('mouseup', handleUp)
    }
  }, [])

  useEffect(() => {
    return () => {
      uploads.forEach(item => URL.revokeObjectURL(item.url))
    }
  }, [uploads])

  function updateValue(key, value) {
    setState(current => ({ ...current, [key]: value }))
  }

  function reset() {
    setState(DEFAULTS)
  }

  function startDrag(event) {
    dragRef.current = {
      active: true,
      startX: event.clientX,
      startY: event.clientY,
      originX: panelPosition.x,
      originY: panelPosition.y,
    }
  }

  async function handleFiles(event) {
    const files = Array.from(event.target.files || [])
    if (files.length === 0) return

    const loaded = await Promise.all(
      files.map(async (file, index) => {
        const url = URL.createObjectURL(file)
        const image = await loadImageFromUrl(url)
        return {
          id: `${file.name}-${Date.now()}-${index}`,
          name: file.name,
          url,
          image,
        }
      })
    )

    setUploads(current => [...current, ...loaded])
    setMode('image')
    setSelectedId(loaded[0]?.id || null)
    event.target.value = ''
  }

  function downloadCurrent() {
    if (!canvasRef.current) return
    const filename =
      mode === 'image' && selectedUpload
        ? `${sanitizeFilename(selectedUpload.name)}-toner.png`
        : 'toner-text.png'
    downloadCanvas(canvasRef.current, filename)
  }

  async function downloadAll() {
    if (uploads.length === 0) return

    setIsBulkDownloading(true)
    const offscreen = document.createElement('canvas')
    offscreen.width = POSTER_WIDTH
    offscreen.height = POSTER_HEIGHT
    const entries = []

    for (const item of uploads) {
      renderTonerCanvas(offscreen, state, { type: 'image', image: item.image })
      const pngBytes = await canvasToPngBytes(offscreen)
      entries.push({
        name: `${sanitizeFilename(item.name)}-toner.png`,
        data: pngBytes,
      })
    }

    const zip = createZip(entries)
    downloadBlob(zip, 'toner-batch.zip')
    setIsBulkDownloading(false)
  }

  return (
    <main className="app-shell">
      <section className="poster-pane">
        <canvas
          ref={canvasRef}
          width={POSTER_WIDTH}
          height={POSTER_HEIGHT}
          className="poster-canvas"
        />
      </section>

      <aside
        className="controls-pane"
        style={{ transform: `translate(${panelPosition.x}px, ${panelPosition.y}px)` }}
      >
        <div className="panel-head" onMouseDown={startDrag}>
          <div className="rail-label">Controls</div>
          <div className="mode-row">
            <button
              type="button"
              className={mode === 'text' ? 'mode-button active' : 'mode-button'}
              onClick={() => setMode('text')}
            >
              text
            </button>
            <button
              type="button"
              className={mode === 'image' ? 'mode-button active' : 'mode-button'}
              onClick={() => setMode('image')}
            >
              image
            </button>
          </div>
        </div>

        {mode === 'text' ? (
          <>
            <div className="section-chip">Text Content</div>
            <label className="text-block">
              <span>headline</span>
              <textarea
                rows={4}
                value={state.headline}
                onChange={event => updateValue('headline', event.target.value)}
              />
            </label>

            <label className="text-block">
              <span>footer A</span>
              <input
                type="text"
                value={state.footerA}
                onChange={event => updateValue('footerA', event.target.value)}
              />
            </label>
          </>
        ) : (
          <>
            <div className="section-chip">Image Batch</div>
            <label className="upload-button">
              <span>upload images</span>
              <input type="file" accept="image/*" multiple onChange={handleFiles} />
            </label>

            <label className="toggle-row">
              <span>source layer</span>
              <input
                type="checkbox"
                checked={state.showSourceLayer}
                onChange={event => updateValue('showSourceLayer', event.target.checked)}
              />
            </label>

            <div className="upload-meta">
              <span>{uploads.length} loaded</span>
              <button type="button" className="action-button" onClick={downloadAll} disabled={uploads.length === 0 || isBulkDownloading}>
                {isBulkDownloading ? 'downloading...' : 'download all'}
              </button>
            </div>

            <div className="upload-list">
              {uploads.map(item => (
                <button
                  key={item.id}
                  type="button"
                  className={selectedUpload?.id === item.id ? 'upload-item active' : 'upload-item'}
                  onClick={() => setSelectedId(item.id)}
                >
                  {item.name}
                </button>
              ))}
            </div>
          </>
        )}

        <div className="download-row">
          <button type="button" className="action-button" onClick={downloadCurrent}>
            download current
          </button>
          <button type="button" className="action-button muted" onClick={reset}>
            reset controls
          </button>
        </div>

        <div className="section-chip">Tone Controls</div>
        <div className="slider-list">
          {previewValues.map(control => (
            <label key={control.key} className="slider-row">
              <div className="slider-meta">
                <span>{control.label}</span>
                <strong>{Number.isInteger(control.value) ? control.value : control.value.toFixed(2)}</strong>
              </div>
              <input
                type="range"
                min={control.min}
                max={control.max}
                step={control.step}
                value={control.value}
                onChange={event => updateValue(control.key, Number(event.target.value))}
              />
            </label>
          ))}
        </div>
      </aside>
    </main>
  )
}
