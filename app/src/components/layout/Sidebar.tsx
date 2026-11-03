import { useEffect, useState } from 'react'
import type { ReactNode } from 'react'
import { Link, NavLink, useLocation } from 'react-router-dom'
import { ArrowRight, ChevronDown, LogOut, Settings, UserRound, UserRoundPlus, X } from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import { navItems, settingsItems } from '../../data/navigation'
import type { Language } from '../../types/preferences'
import type { Translation } from '../../data/i18n'
import { Brand } from '../brand/Brand'
import { AccountIdentity } from './AccountIdentity'
import type { UserProfile } from '../../services/profileService'
import { Button } from '@/components/ui/button'
import {
  Sidebar as UiSidebar, SidebarContent, SidebarFooter, SidebarGroup, SidebarGroupLabel, SidebarHeader, SidebarMenu,
  SidebarMenuButton, SidebarMenuItem, SidebarMenuSub, SidebarMenuSubButton, SidebarMenuSubItem, SidebarSeparator, SidebarTrigger, useSidebar,
} from '@/components/ui/sidebar'

// NavLink sets aria-current on the active route; style it instead of re-matching paths.
export const activeLink = 'aria-[current=page]:bg-sidebar-accent aria-[current=page]:font-semibold aria-[current=page]:text-accent-text'
// Icons keep their tone on hover/active; `!` beats SidebarMenuSubButton's `[&>svg]:text-*`.
export const toneText: Record<string, string> = { blue: 'text-info!', green: 'text-success!', violet: 'text-violet!', amber: 'text-warning!', rose: 'text-tone-rose-fg!', cyan: 'text-tone-cyan-fg!' }

// Collapse state (desktop) and the mobile sheet live in the SidebarProvider that App controls.
export function useSidebarNav() {
  const { isMobile, state, setOpenMobile } = useSidebar()
  return { iconOnly: !isMobile && state === 'collapsed', close: () => setOpenMobile(false) }
}

type FrameProps = { mobileTitle: string; toggleLabel: string; closeLabel: string; footer: ReactNode; children: ReactNode }
// Shared shell for the user, admin and moderator sidebars: brand + toggle, scrollable menu, footer.
export function SidebarFrame({ mobileTitle, toggleLabel, closeLabel, footer, children }: FrameProps) {
  const { isMobile, setOpenMobile } = useSidebar()
  const { iconOnly } = useSidebarNav()
  return <UiSidebar collapsible="icon" mobileTitle={mobileTitle}>
    <SidebarHeader className="h-16 flex-row items-center justify-between border-b border-sidebar-border px-3 group-data-[collapsible=icon]:h-auto group-data-[collapsible=icon]:flex-col group-data-[collapsible=icon]:px-2 group-data-[collapsible=icon]:py-3 pointer-coarse:group-data-[collapsible=icon]:px-0.5">
      <Brand compact={iconOnly} />
      {isMobile
        ? <Button variant="ghost" size="icon" onClick={() => setOpenMobile(false)} aria-label={closeLabel}><X /></Button>
        : <SidebarTrigger label={toggleLabel} className="size-8 text-muted-foreground" />}
    </SidebarHeader>
    <SidebarContent><nav className="flex flex-1 flex-col">{children}</nav></SidebarContent>
    <SidebarFooter className="border-t border-sidebar-border group-data-[collapsible=icon]:px-1">{footer}</SidebarFooter>
  </UiSidebar>
}

type SettingsLink = { path: string; icon: LucideIcon; tone: string; label: string }
// Collapsed by default; opens whenever the current page is one of its links so the active link stays visible.
export function SettingsMenu({ label, links, className }: { label: string; links: SettingsLink[]; className?: string }) {
  const { pathname } = useLocation()
  const { iconOnly, close } = useSidebarNav()
  const { setOpen } = useSidebar()
  const inSettings = links.some(link => link.path === pathname)
  const [open, setSettingsOpen] = useState(inSettings)
  useEffect(() => { if (inSettings) setSettingsOpen(true) }, [inSettings])
  return <SidebarGroup className={className}>
    <SidebarMenu>
      <SidebarMenuItem>
        <SidebarMenuButton tooltip={label} aria-expanded={open} onClick={() => { if (iconOnly) { setOpen(true); setSettingsOpen(true) } else setSettingsOpen(!open) }}>
          <Settings className={toneText.amber} data-tone="amber" /><span>{label}</span><ChevronDown className={`ml-auto transition-transform ${open ? 'rotate-180' : ''}`} />
        </SidebarMenuButton>
        {open && !iconOnly && <SidebarMenuSub className="animate-in fade-in slide-in-from-top-1">
          {links.map(({ path, icon: Icon, tone, label }) => <SidebarMenuSubItem key={path}><SidebarMenuSubButton asChild className={activeLink}><NavLink to={path} onClick={close}><Icon className={toneText[tone]} data-tone={tone} /><span>{label}</span></NavLink></SidebarMenuSubButton></SidebarMenuSubItem>)}
        </SidebarMenuSub>}
      </SidebarMenuItem>
    </SidebarMenu>
  </SidebarGroup>
}

export function SidebarAccount({ profile, onLogout, logoutLabel }: { profile: UserProfile | null; onLogout: () => void; logoutLabel: string }) {
  return <div className="flex min-w-0 items-center gap-2 group-data-[collapsible=icon]:flex-col">
    <AccountIdentity profile={profile} />
    <Button variant="ghost" size="icon" className="size-8 shrink-0 text-muted-foreground" onClick={onLogout} aria-label={logoutLabel}><LogOut /></Button>
  </div>
}

type Props = { language: Language; t: Translation; authenticated: boolean; roles: string[]; profile: UserProfile | null; onLogout: () => void }
export function Sidebar({ language, t, authenticated, roles, profile, onLogout }: Props) {
  const { iconOnly, close } = useSidebarNav()
  const isAuthor = roles.includes('AUTHOR')
  const subLinks = [
    ...(authenticated ? [{ path: '/profile', icon: UserRound, tone: 'blue', label: language === 'vi' ? 'Thông tin cá nhân' : 'Personal information' }] : []),
    ...settingsItems.map(({ path, icon, key, tone }) => ({ path, icon, tone, label: t[key as 'appearance' | 'language'] })),
  ]
  const footer = authenticated
    ? <SidebarAccount profile={profile} onLogout={onLogout} logoutLabel="Log out" />
    : <SidebarMenu>
      <SidebarMenuItem><SidebarMenuButton asChild tooltip={t.login} className="bg-primary text-primary-foreground hover:bg-primary/90 hover:text-primary-foreground"><Link to="/login" onClick={close}><ArrowRight /><span>{t.login}</span></Link></SidebarMenuButton></SidebarMenuItem>
      <SidebarMenuItem><SidebarMenuButton asChild variant="outline" tooltip={t.signup}><Link to="/register" onClick={close}><UserRoundPlus /><span>{t.signup}</span></Link></SidebarMenuButton></SidebarMenuItem>
    </SidebarMenu>
  return <SidebarFrame mobileTitle={t.mainMenu} toggleLabel={iconOnly ? 'Expand menu' : 'Collapse menu'} closeLabel="Close menu" footer={footer}>
    <SidebarGroup>
      <SidebarGroupLabel className="uppercase tracking-[.05em]">{t.mainMenu}</SidebarGroupLabel>
      <SidebarMenu>
        {navItems.map(({ path, icon: Icon, label, tone }) => <SidebarMenuItem key={path}><SidebarMenuButton asChild tooltip={label[language]} className={activeLink}><NavLink to={path} end={path === '/'} onClick={close}><Icon className={toneText[tone]} data-tone={tone} /><span>{label[language]}</span></NavLink></SidebarMenuButton></SidebarMenuItem>)}
        {authenticated && <SidebarMenuItem><SidebarMenuButton asChild tooltip={language === 'vi' ? 'Tác giả' : 'Author'} className={activeLink}><NavLink to={isAuthor ? '/author/blogs' : '/author/apply'} onClick={close}><UserRound className={toneText.violet} data-tone="violet" /><span>{language === 'vi' ? 'Tác giả' : 'Author'}</span></NavLink></SidebarMenuButton></SidebarMenuItem>}
      </SidebarMenu>
    </SidebarGroup>
    {authenticated && <SidebarSeparator />}
    <SettingsMenu label={t.settings} links={subLinks} />
  </SidebarFrame>
}
