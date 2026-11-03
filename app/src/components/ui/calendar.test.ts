import { expect, it } from 'vitest'
import source from './calendar.tsx?raw'

// QĐ 1A: month/year dropdowns are the main control for picking a birth year, so they need 44px on touch screens.
it('gives the month and year dropdowns a 44px touch target', () => {
  const block = (key: string) => source.slice(source.indexOf(`${key}: cn(`), source.indexOf('defaultClassNames.', source.indexOf(`${key}: cn(`)))
  expect(block('dropdown_root')).toContain('pointer-coarse:min-h-11')
  expect(block('dropdowns')).toContain('pointer-coarse:h-11')
})
