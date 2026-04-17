import { config } from '../src/lib/config'

type ColorPair = { dark: string; light: string }
type ColorValue = string | ColorPair

function isColorPair(v: ColorValue): v is ColorPair {
  return typeof v === 'object' && 'dark' in v && 'light' in v
}

export function generateCssVars(): string {
  const { colors, fonts, radius, contentWidth, pageWidth } = config.theme

  const lightVars: string[] = []
  const darkVars: string[] = []

  for (const [key, value] of Object.entries(colors)) {
    if (isColorPair(value as ColorValue)) {
      const pair = value as ColorPair
      lightVars.push(`  --ink-${key}: ${pair.light};`)
      darkVars.push(`  --ink-${key}: ${pair.dark};`)
    } else {
      const v = value as string
      lightVars.push(`  --ink-${key}: ${v};`)
      darkVars.push(`  --ink-${key}: ${v};`)
    }
  }

  // Derived vars that components reference but aren't in config directly
  const derivedLight: string[] = []
  const derivedDark: string[] = []

  // --ink-surface-hover: slightly brighter surface for hover states
  derivedLight.push('  --ink-surface-hover: rgba(0,0,0,0.04);')
  derivedDark.push('  --ink-surface-hover: rgba(255,255,255,0.06);')

  // --ink-primary-muted: primary with low opacity for backgrounds
  const primaryColor = colors.primary as string
  derivedLight.push(`  --ink-primary-muted: ${primaryColor}1A;`)
  derivedDark.push(`  --ink-primary-muted: ${primaryColor}1A;`)

  // --ink-text-muted: alias for --ink-muted (components use both names)
  if (isColorPair(colors.muted as ColorValue)) {
    const pair = colors.muted as ColorPair
    derivedLight.push(`  --ink-text-muted: ${pair.light};`)
    derivedDark.push(`  --ink-text-muted: ${pair.dark};`)
  }

  // --ink-text-dim: alias for --ink-dim (components use both names)
  if (isColorPair(colors.dim as ColorValue)) {
    const pair = colors.dim as ColorPair
    derivedLight.push(`  --ink-text-dim: ${pair.light};`)
    derivedDark.push(`  --ink-text-dim: ${pair.dark};`)
  }

  lightVars.push(...derivedLight)
  darkVars.push(...derivedDark)

  const sharedVars = [
    `  --ink-font-display: ${fonts.display};`,
    `  --ink-font-body: ${fonts.body};`,
    `  --ink-font-mono: ${fonts.mono};`,
    `  --ink-radius: ${radius};`,
    `  --ink-content-width: ${contentWidth};`,
    `  --ink-page-width: ${pageWidth};`,
  ].join('\n')

  return `/* Auto-generated from inkwell.config.ts — do not edit */
:root {
${lightVars.join('\n')}
${sharedVars}
}

:root.dark {
${darkVars.join('\n')}
}

@media (prefers-color-scheme: dark) {
  :root:not(.light) {
${darkVars.join('\n')}
  }
}
`
}
