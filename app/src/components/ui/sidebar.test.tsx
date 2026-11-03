import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, expect, it, vi } from 'vitest'
import { Sidebar, SidebarProvider, SidebarTrigger } from './sidebar'

// TechVerse owns sidebar state (localStorage `techverse-sidebar`): no registry cookie, no Ctrl+B, 320px mobile sheet.
const width = window.innerWidth
afterEach(() => { cleanup(); window.innerWidth = width; document.cookie = 'sidebar_state=; max-age=0; path=/' })

const renderSidebar = (onOpenChange = vi.fn()) => render(
  <SidebarProvider open onOpenChange={onOpenChange}>
    <Sidebar mobileTitle="Điều hướng"><p>menu</p></Sidebar>
    <SidebarTrigger label="Thu gọn" />
  </SidebarProvider>,
)

it('does not write the sidebar_state cookie when toggled', async () => {
  const onOpenChange = vi.fn()
  renderSidebar(onOpenChange)
  await userEvent.click(screen.getByRole('button', { name: 'Thu gọn' }))
  expect(onOpenChange).toHaveBeenCalledWith(false)
  expect(document.cookie).not.toContain('sidebar_state')
})

it('ignores the Ctrl+B / Cmd+B shortcut', () => {
  const onOpenChange = vi.fn()
  renderSidebar(onOpenChange)
  fireEvent.keyDown(window, { key: 'b', ctrlKey: true })
  fireEvent.keyDown(window, { key: 'b', metaKey: true })
  expect(onOpenChange).not.toHaveBeenCalled()
})

// Decision 1A: touch targets are at least 44px on coarse pointers (jsdom cannot evaluate the media query, so scan the source).
it('gives menu and sub-menu buttons a 44px touch target on coarse pointers', async () => {
  const source = (await import('./sidebar.tsx?raw')).default as string
  const classesOf = (name: string) => source.slice(source.indexOf(name)).split('\n').slice(0, 30).join('\n')
  expect(classesOf('const sidebarMenuButtonVariants')).toMatch(/pointer-coarse:min-h-11 pointer-coarse:min-w-11/)
  expect(classesOf('data-slot="sidebar-menu-sub-button"')).toMatch(/pointer-coarse:min-h-11/)
  // Collapsed rail is 48px: groups/footer drop to 2px side padding so a 44px target fits without clipping.
  for (const slot of ['sidebar-group', 'sidebar-footer']) expect(classesOf(`data-slot="${slot}"`)).toMatch(/pointer-coarse:group-data-\[collapsible=icon\]:px-0\.5/)
})

it('opens a 320px sheet on mobile', async () => {
  window.innerWidth = 500
  renderSidebar()
  await userEvent.click(screen.getByRole('button', { name: 'Thu gọn' }))
  expect(screen.getByRole('dialog', { name: 'Điều hướng' }).style.getPropertyValue('--sidebar-width')).toBe('20rem')
})
