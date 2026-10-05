import { Activity, Check, ChevronsUpDown, LayoutDashboard, LogOut, Menu, Plus, Settings, Users, Workflow, X } from 'lucide-react'
import { useEffect, useRef, useState, type ReactNode } from 'react'
import { Link, NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom'
import { useAccounts } from '../lib/accounts'
import { useAuth } from '../lib/auth'
import { cn } from '../lib/utils'
import { Avatar } from './Avatar'
import { InstagramIcon } from './InstagramIcon'

const NAV = [
  { to: '/', label: 'Dashboard', icon: LayoutDashboard, end: true },
  { to: '/automations', label: 'Automations', icon: Workflow, end: false },
  { to: '/contacts', label: 'Contacts', icon: Users, end: false },
  { to: '/activity', label: 'Activity', icon: Activity, end: false },
  { to: '/accounts', label: 'Settings', icon: Settings, end: false },
]

export function Logo({ className }: { className?: string }) {
  return (
    <Link to="/" className={cn('flex items-center gap-2.5', className)}>
      <span className="flex size-8 items-center justify-center rounded-lg bg-gradient-to-br from-indigo-500 to-violet-500 shadow-sm shadow-indigo-500/30">
        <svg viewBox="0 0 32 32" className="size-5" aria-hidden>
          <path d="M7 10.5a3.5 3.5 0 0 1 3.5-3.5h11a3.5 3.5 0 0 1 3.5 3.5v6a3.5 3.5 0 0 1-3.5 3.5H15l-5 4v-4.1A3.5 3.5 0 0 1 7 16.5z" fill="#fff" />
          <path d="M12 13.5h8" stroke="#6366f1" strokeWidth="2" strokeLinecap="round" />
        </svg>
      </span>
      <span className="text-[17px] font-semibold tracking-tight text-slate-900">FlowDM</span>
    </Link>
  )
}

function AccountSwitcher() {
  const { accounts, account, select, loading } = useAccounts()
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    const onDown = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setOpen(false)
    document.addEventListener('mousedown', onDown)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('mousedown', onDown)
      document.removeEventListener('keydown', onKey)
    }
  }, [open])

  if (loading) {
    return <div className="h-[52px] animate-pulse rounded-xl bg-slate-100" />
  }

  if (!account) {
    return (
      <Link
        to="/accounts"
        className="flex items-center gap-3 rounded-xl border border-dashed border-indigo-300 bg-indigo-50/50 px-3 py-2.5 text-sm font-medium text-indigo-700 hover:bg-indigo-50"
      >
        <span className="flex size-8 items-center justify-center rounded-full bg-white ring-1 ring-indigo-200">
          <InstagramIcon className="size-4" />
        </span>
        Connect Instagram
      </Link>
    )
  }

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-haspopup="listbox"
        aria-expanded={open}
        className="flex w-full items-center gap-3 rounded-xl border border-slate-200 bg-white px-2.5 py-2 text-left shadow-xs transition hover:border-slate-300 hover:bg-slate-50"
      >
        <Avatar src={account.profile_picture_url} name={account.name} username={account.username} size={34} />
        <span className="min-w-0 flex-1">
          <span className="block truncate text-sm font-semibold text-slate-900">@{account.username}</span>
          <span className="flex items-center gap-1.5 text-xs whitespace-nowrap text-slate-500">
            <span className={cn('size-1.5 shrink-0 rounded-full', account.is_active ? 'bg-emerald-500' : 'bg-slate-300')} />
            <span className="truncate">
              {account.is_active ? 'Active' : 'Paused'}
              {accounts.length > 1 && <span className="text-slate-400"> · {accounts.length} accounts</span>}
            </span>
          </span>
        </span>
        <ChevronsUpDown className="size-4 shrink-0 text-slate-400" />
      </button>
      {open && (
        <div
          role="listbox"
          className="animate-pop-in absolute inset-x-0 top-full z-30 mt-1.5 overflow-hidden rounded-xl bg-white p-1 shadow-lg ring-1 ring-slate-900/10"
        >
          <div className="max-h-64 overflow-y-auto">
            {accounts.map((a) => (
              <button
                key={a.id}
                type="button"
                role="option"
                aria-selected={a.id === account.id}
                onClick={() => {
                  select(a.id)
                  setOpen(false)
                }}
                className="flex w-full items-center gap-2.5 rounded-lg px-2 py-1.5 text-left text-sm hover:bg-slate-50"
              >
                <Avatar src={a.profile_picture_url} name={a.name} username={a.username} size={26} />
                <span className="min-w-0 flex-1 truncate font-medium text-slate-800">@{a.username}</span>
                {a.id === account.id && <Check className="size-4 text-indigo-600" />}
              </button>
            ))}
          </div>
          <div className="my-1 border-t border-slate-100" />
          <Link
            to="/accounts"
            onClick={() => setOpen(false)}
            className="flex items-center gap-2.5 rounded-lg px-2 py-1.5 text-sm font-medium text-slate-600 hover:bg-slate-50 hover:text-slate-900"
          >
            <span className="flex size-[26px] items-center justify-center rounded-full bg-slate-100">
              <Plus className="size-3.5" />
            </span>
            Connect another account
          </Link>
        </div>
      )}
    </div>
  )
}

function SidebarContent({ onClose }: { onClose?: () => void }) {
  const { user, logout } = useAuth()
  const navigate = useNavigate()
  return (
    <div className="flex h-full flex-col">
      <div className="space-y-4 px-4 pt-5 pb-4">
        <div className="flex items-center justify-between">
          <Logo />
          {onClose && (
            <button
              type="button"
              onClick={onClose}
              aria-label="Close menu"
              className="rounded-lg p-1.5 text-slate-500 hover:bg-slate-100 hover:text-slate-700"
            >
              <X className="size-5" />
            </button>
          )}
        </div>
        <AccountSwitcher />
      </div>
      <nav className="flex-1 space-y-0.5 overflow-y-auto px-3 py-2" aria-label="Main">
        {NAV.map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            end={item.end}
            className={({ isActive }) =>
              cn(
                'group flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors',
                isActive ? 'bg-indigo-50 text-indigo-700' : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900',
              )
            }
          >
            {({ isActive }) => (
              <>
                <item.icon className={cn('size-[18px]', isActive ? 'text-indigo-600' : 'text-slate-400 group-hover:text-slate-500')} />
                {item.label}
              </>
            )}
          </NavLink>
        ))}
      </nav>
      <div className="border-t border-slate-200 p-3">
        <div className="flex items-center gap-2.5 rounded-lg px-2 py-1.5">
          <Avatar name={user?.email} size={30} />
          <span className="min-w-0 flex-1 truncate text-sm text-slate-600" title={user?.email}>
            {user?.email}
          </span>
          <button
            type="button"
            onClick={async () => {
              await logout().catch(() => undefined)
              navigate('/login', { replace: true })
            }}
            aria-label="Log out"
            title="Log out"
            className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-700"
          >
            <LogOut className="size-4" />
          </button>
        </div>
      </div>
    </div>
  )
}

export function Layout() {
  const [mobileOpen, setMobileOpen] = useState(false)
  const location = useLocation()
  const { account } = useAccounts()

  useEffect(() => {
    setMobileOpen(false)
  }, [location.pathname])

  useEffect(() => {
    if (!mobileOpen) return
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setMobileOpen(false)
    document.addEventListener('keydown', onKey)
    const overflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      document.removeEventListener('keydown', onKey)
      document.body.style.overflow = overflow
    }
  }, [mobileOpen])

  return (
    <div className="min-h-dvh">
      {/* Desktop sidebar */}
      <aside className="fixed inset-y-0 left-0 z-20 hidden w-64 border-r border-slate-200 bg-white lg:block">
        <SidebarContent />
      </aside>

      {/* Mobile top bar */}
      <header className="sticky top-0 z-20 flex h-14 items-center gap-3 border-b border-slate-200 bg-white/90 px-4 backdrop-blur lg:hidden">
        <button
          type="button"
          onClick={() => setMobileOpen(true)}
          aria-label="Open menu"
          className="-ml-1.5 rounded-lg p-1.5 text-slate-600 hover:bg-slate-100"
        >
          <Menu className="size-5" />
        </button>
        <Logo />
        <div className="ml-auto">
          {account && (
            <button type="button" onClick={() => setMobileOpen(true)} className="flex items-center gap-2 text-sm text-slate-600">
              <span className="hidden max-w-[9rem] truncate sm:inline">@{account.username}</span>
              <Avatar src={account.profile_picture_url} name={account.name} username={account.username} size={28} />
            </button>
          )}
        </div>
      </header>

      {/* Mobile drawer */}
      {mobileOpen && (
        <div className="fixed inset-0 z-40 lg:hidden" role="dialog" aria-modal="true" aria-label="Menu">
          <div className="animate-fade-in absolute inset-0 bg-slate-900/40" onClick={() => setMobileOpen(false)} aria-hidden />
          <aside className="animate-slide-in absolute inset-y-0 left-0 w-[17rem] max-w-[85vw] bg-white shadow-xl">
            <SidebarContent onClose={() => setMobileOpen(false)} />
          </aside>
        </div>
      )}

      <main className="min-w-0 lg:pl-64">
        <div className="mx-auto w-full max-w-6xl px-4 py-6 sm:px-6 lg:px-8 lg:py-8">
          <Outlet />
        </div>
      </main>
    </div>
  )
}

/** Renders children only when an Instagram account is selected; otherwise a connect prompt. */
export function RequireAccount({ children }: { children: (accountId: number) => ReactNode }) {
  const { accountId, loading, error, reload } = useAccounts()
  if (loading) return <AccountLoading />
  if (error && accountId == null) {
    return (
      <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-800">
        Couldn't load your Instagram accounts: {error}{' '}
        <button type="button" className="font-semibold underline" onClick={() => void reload()}>
          Try again
        </button>
      </div>
    )
  }
  if (accountId == null) return <NoAccount />
  return <>{children(accountId)}</>
}

function AccountLoading() {
  return (
    <div className="space-y-4">
      <div className="h-8 w-48 animate-pulse rounded-lg bg-slate-200/70" />
      <div className="h-48 animate-pulse rounded-xl bg-slate-200/50" />
    </div>
  )
}

export function NoAccount() {
  return (
    <div className="flex flex-col items-center rounded-2xl border border-dashed border-slate-300 bg-white px-6 py-16 text-center">
      <div className="mb-4 flex size-14 items-center justify-center rounded-2xl bg-gradient-to-br from-fuchsia-500 via-rose-500 to-amber-400 text-white shadow-md">
        <InstagramIcon className="size-7" />
      </div>
      <h2 className="text-lg font-semibold text-slate-900">Connect your Instagram account</h2>
      <p className="mt-1 max-w-md text-sm text-slate-500">
        FlowDM needs a connected Instagram professional account before it can reply to comments and DMs.
      </p>
      <Link
        to="/accounts"
        className="mt-5 inline-flex h-10 items-center gap-2 rounded-lg bg-indigo-600 px-4 text-sm font-medium text-white shadow-xs hover:bg-indigo-500"
      >
        <InstagramIcon className="size-4" />
        Connect account
      </Link>
    </div>
  )
}
