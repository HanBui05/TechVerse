import { describe, expect, it } from 'vitest'
import { iconFill, initials, searchIcons, suggestIcons, type BrandIcon } from './topicIcons'

const icon = (slug: string, title: string, hex = '2496ED'): BrandIcon => ({ slug, title, hex, path: 'M0 0h24v24H0z' })
const icons = [icon('javascript', 'JavaScript'), icon('openjdk', 'OpenJDK'), icon('docker', 'Docker'), icon('springboot', 'Spring Boot'), icon('spring', 'Spring'), icon('dockerhub', 'Docker Hub')]

describe('searchIcons', () => {
  it('ranks an exact slug first, then title prefixes, then partial matches', () => {
    expect(searchIcons(icons, 'docker').map(i => i.slug)).toEqual(['docker', 'dockerhub'])
    expect(searchIcons(icons, 'Spring Boot').map(i => i.slug)[0]).toBe('springboot')
    expect(searchIcons(icons, 'jdk').map(i => i.slug)).toEqual(['openjdk'])
  })
  it('suggests a substitute logo for brands missing from simple-icons', () => {
    expect(searchIcons(icons, 'Java').map(i => i.slug)).toEqual(['openjdk', 'javascript'])
  })
  it('ignores case, spaces and punctuation and respects the limit', () => {
    expect(searchIcons(icons, '  SPRING-boot ').map(i => i.slug)[0]).toBe('springboot')
    expect(searchIcons(icons, 'o', 2)).toHaveLength(2)
    expect(searchIcons(icons, '   ')).toEqual([])
  })
})

describe('suggestIcons', () => {
  const map = new Map(icons.map(i => [i.slug, i]))
  it('shows the popular set when nothing is typed, name matches first and no duplicates', () => {
    expect(suggestIcons(map, '', '').map(i => i.slug)).toEqual(['javascript', 'openjdk', 'spring', 'springboot', 'docker'])
    expect(suggestIcons(map, '', 'Docker').map(i => i.slug)).toEqual(['docker', 'dockerhub', 'javascript', 'openjdk', 'spring', 'springboot'])
  })
  it('searches every icon once a query is typed', () => {
    expect(suggestIcons(map, 'hub', 'Docker').map(i => i.slug)).toEqual(['dockerhub'])
  })
})

describe('iconFill', () => {
  it('keeps the brand colour unless it would vanish on a dark or light surface', () => {
    expect(iconFill('2496ED')).toBe('#2496ED')
    expect(iconFill('000000')).toBe('currentColor')
    expect(iconFill('181717')).toBe('currentColor')
    expect(iconFill('FFFFFF')).toBe('currentColor')
  })
})

describe('initials', () => {
  it('uses the first letters of the first two words, or two letters of a single word', () => {
    expect(initials('Cơ sở dữ liệu')).toBe('CS')
    expect(initials('Kotlin')).toBe('KO')
    expect(initials('  ai  ')).toBe('AI')
    expect(initials('C')).toBe('C')
  })
})
