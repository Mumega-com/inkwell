import { config } from '../src/lib/config'

type ColorPair = { dark: string; light: string }
type ColorValue = string | ColorPair

function isColorPair(v: ColorValue): v is ColorPair {
  return typeof v === 'object' && 'dark' in v && 'light' in v
}

// Defaults used when config omits optional scales
const DEFAULT_SPACING: Record<string, string> = {
  xs: '0.25rem',
  sm: '0.5rem',
  md: '1rem',
  lg: '1.5rem',
  xl: '2rem',
  '2xl': '3rem',
  '3xl': '4rem',
}

const DEFAULT_TYPOGRAPHY: Record<string, { size: string; lineHeight: string }> = {
  xs:  { size: '0.75rem',  lineHeight: '1rem' },
  sm:  { size: '0.875rem', lineHeight: '1.25rem' },
  md:  { size: '1rem',     lineHeight: '1.5rem' },
  lg:  { size: '1.125rem', lineHeight: '1.75rem' },
  xl:  { size: '1.25rem',  lineHeight: '1.75rem' },
  '2xl': { size: '1.5rem',   lineHeight: '2rem' },
  '3xl': { size: '1.875rem', lineHeight: '2.25rem' },
}

const DEFAULT_SHADOWS: Record<string, string> = {
  sm: '0 1px 2px rgba(0,0,0,0.05)',
  md: '0 4px 6px rgba(0,0,0,0.07), 0 2px 4px rgba(0,0,0,0.06)',
  lg: '0 10px 15px rgba(0,0,0,0.1), 0 4px 6px rgba(0,0,0,0.05)',
}

export function generateCssVars(): string {
  const { colors, fonts, radius, contentWidth, pageWidth } = config.theme

  // Merge with defaults — config values override defaults
  const theme = config.theme as Record<string, unknown>
  const spacing = { ...DEFAULT_SPACING, ...(theme.spacing as Record<string, string> | undefined) }
  const typography = { ...DEFAULT_TYPOGRAPHY, ...(theme.typography as Record<string, { size: string; lineHeight: string }> | undefined) }
  const shadows = { ...DEFAULT_SHADOWS, ...(theme.shadows as Record<string, string> | undefined) }

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

  // Spacing scale
  const spacingVars = Object.entries(spacing).map(
    ([key, value]) => `  --ink-space-${key}: ${value};`
  )

  // Typography scale
  const typographyVars = Object.entries(typography).flatMap(
    ([key, value]) => [
      `  --ink-text-size-${key}: ${value.size};`,
      `  --ink-text-lh-${key}: ${value.lineHeight};`,
    ]
  )

  // Shadow tokens
  const shadowVars = Object.entries(shadows).map(
    ([key, value]) => `  --ink-shadow-${key}: ${value};`
  )

  const sharedVars = [
    `  --ink-font-display: ${fonts.display};`,
    `  --ink-font-body: ${fonts.body};`,
    `  --ink-font-mono: ${fonts.mono};`,
    `  --ink-radius: ${radius};`,
    `  --ink-content-width: ${contentWidth};`,
    `  --ink-page-width: ${pageWidth};`,
    ...spacingVars,
    ...typographyVars,
    ...shadowVars,
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
