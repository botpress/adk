// JavaScript to inject into the page to extract color palette from DOM
// This script runs in the browser context and extracts colors from computed styles
// It creates a visual overlay with color swatches that the vision model can see

const scriptContent = `;(() => {
  function rgbToHex(rgb) {
    const m = rgb.match(/rgba?\\((\\d+), ?(\\d+), ?(\\d+)/)
    if (!m) return ''
    return (
      '#' +
      [1, 2, 3]
        .map((i) => {
          const hex = parseInt(m[i]).toString(16)
          return hex.length === 1 ? '0' + hex : hex
        })
        .join('')
    )
  }

  function getContrastYIQ(hexcolor) {
    const r = parseInt(hexcolor.substr(1, 2), 16)
    const g = parseInt(hexcolor.substr(3, 2), 16)
    const b = parseInt(hexcolor.substr(5, 2), 16)
    const yiq = (r * 299 + g * 587 + b * 114) / 1000
    return yiq >= 128 ? 'black' : 'white'
  }

  function addToMap(map, key) {
    map.set(key, (map.get(key) || 0) + 1)
  }

  const buttons = Array.from(document.querySelectorAll('button'))
  const links = Array.from(document.querySelectorAll('a'))
  const headers = Array.from(document.querySelectorAll('h1,h2,h3,h4,h5,h6'))
  const paragraphs = Array.from(document.querySelectorAll('p'))
  const allElements = Array.from(document.querySelectorAll('*'))

  const bgElements = allElements.filter((el) => {
    const bg = getComputedStyle(el).backgroundColor
    if (!bg || bg === 'transparent' || bg === 'rgba(0, 0, 0, 0)') return false
    if (el.tagName === 'BODY') return false
    if (buttons.includes(el) || links.includes(el) || headers.includes(el) || paragraphs.includes(el)) return false
    return true
  })

  const bgColors = new Map()
  const btnTextColors = new Map()
  const btnBgColors = new Map()
  const linkTextColors = new Map()
  const linkBgColors = new Map()
  const textColors = new Map()
  const headerColors = new Map()

  buttons.forEach((el) => {
    const cText = rgbToHex(getComputedStyle(el).color)
    if (cText) addToMap(btnTextColors, cText)

    const cBg = rgbToHex(getComputedStyle(el).backgroundColor)
    if (cBg) addToMap(btnBgColors, cBg)
  })

  links.forEach((el) => {
    const cText = rgbToHex(getComputedStyle(el).color)
    if (cText) addToMap(linkTextColors, cText)

    const cBg = rgbToHex(getComputedStyle(el).backgroundColor)
    if (cBg) addToMap(linkBgColors, cBg)
  })

  headers.forEach((el) => {
    const c = rgbToHex(getComputedStyle(el).color)
    if (c) addToMap(headerColors, c)
  })

  paragraphs.forEach((el) => {
    const c = rgbToHex(getComputedStyle(el).color)
    if (c) addToMap(textColors, c)
  })

  bgElements.forEach((el) => {
    const c = rgbToHex(getComputedStyle(el).backgroundColor)
    if (c) addToMap(bgColors, c)
  })

  function sortMapByCount(map) {
    return Array.from(map.entries()).sort((a, b) => b[1] - a[1])
  }

  let overlay = document.getElementById('color-extract-overlay')

  if (!overlay) {
    overlay = document.createElement('div')
    overlay.id = 'color-extract-overlay'
    Object.assign(overlay.style, {
      position: 'fixed',
      top: '0',
      left: '0',
      right: '0',
      backgroundColor: 'rgba(0,0,0,0.9)',
      color: 'white',
      fontFamily: 'monospace',
      fontSize: '16px',
      padding: '16px',
      borderBottom: '3px solid fuchsia',
      zIndex: '100000',
      boxSizing: 'border-box',
      display: 'flex',
      flexDirection: 'row',
      gap: '20px',
      alignItems: 'center',
      flexWrap: 'wrap',
    })
    document.body.appendChild(overlay)
  } else {
    overlay.innerHTML = ''
  }

  function renderColorItem(colorHex, count, category) {
    const item = document.createElement('div')
    item.style.display = 'flex'
    item.style.flexDirection = 'column'
    item.style.alignItems = 'center'
    item.style.gap = '4px'
    item.style.minWidth = '80px'

    const colorBox = document.createElement('div')
    colorBox.textContent = '   '
    Object.assign(colorBox.style, {
      backgroundColor: colorHex,
      width: '50px',
      height: '35px',
      borderRadius: '6px',
      border: '2px solid ' + (getContrastYIQ(colorHex) === 'white' ? '#fff' : '#000'),
      flexShrink: '0',
    })

    const label = document.createElement('div')
    label.textContent = colorHex
    label.style.userSelect = 'text'
    label.style.fontSize = '14px'
    label.style.fontWeight = '600'

    const countLabel = document.createElement('div')
    countLabel.textContent = '(' + count + ')'
    countLabel.style.fontSize = '12px'
    countLabel.style.color = '#aaa'

    const categoryLabel = document.createElement('div')
    categoryLabel.textContent = category
    categoryLabel.style.fontSize = '10px'
    categoryLabel.style.color = '#888'
    categoryLabel.style.textTransform = 'uppercase'

    item.appendChild(colorBox)
    item.appendChild(label)
    item.appendChild(countLabel)
    item.appendChild(categoryLabel)

    return item
  }

  // Combine all colors and render them
  const allColors = [
    ...Array.from(bgColors.entries()).map(([color, count]) => ({ color, count, category: 'Background' })),
    ...Array.from(btnTextColors.entries()).map(([color, count]) => ({ color, count, category: 'Button Text' })),
    ...Array.from(btnBgColors.entries()).map(([color, count]) => ({ color, count, category: 'Button BG' })),
    ...Array.from(linkTextColors.entries()).map(([color, count]) => ({ color, count, category: 'Link Text' })),
    ...Array.from(linkBgColors.entries()).map(([color, count]) => ({ color, count, category: 'Link BG' })),
    ...Array.from(textColors.entries()).map(([color, count]) => ({ color, count, category: 'Paragraph' })),
    ...Array.from(headerColors.entries()).map(([color, count]) => ({ color, count, category: 'Header' })),
  ]

  // Sort by count and take top 15
  const sortedColors = allColors.sort((a, b) => b.count - a.count).slice(0, 30)

  sortedColors.forEach(({ color, count, category }) => {
    const item = renderColorItem(color, count, category)
    overlay.appendChild(item)
  })

  // Push the original website content down to match overlay height
  const overlayHeight = overlay.offsetHeight
  document.body.style.marginTop = overlayHeight + 'px'
})()`;

export default scriptContent;
