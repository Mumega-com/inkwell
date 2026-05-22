import { useEffect, useState } from 'react'

type BeforeInstallPromptEvent = Event & {
  prompt: () => Promise<void>
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>
}

const STORAGE_KEY = 'mumega-portal-install-dismissed'

export function PortalInstallPrompt() {
  const [installEvent, setInstallEvent] = useState<BeforeInstallPromptEvent | null>(null)
  const [visible, setVisible] = useState(false)

  useEffect(() => {
    if (localStorage.getItem(STORAGE_KEY) === 'true') return

    const onBeforeInstallPrompt = (event: Event) => {
      event.preventDefault()
      setInstallEvent(event as BeforeInstallPromptEvent)
      setVisible(true)
    }

    window.addEventListener('beforeinstallprompt', onBeforeInstallPrompt)
    return () => window.removeEventListener('beforeinstallprompt', onBeforeInstallPrompt)
  }, [])

  if (!visible || !installEvent) return null

  const dismiss = () => {
    localStorage.setItem(STORAGE_KEY, 'true')
    setVisible(false)
  }

  const install = async () => {
    await installEvent.prompt()
    await installEvent.userChoice
    dismiss()
  }

  return (
    <div className="fixed inset-x-4 bottom-4 z-50 mx-auto max-w-md rounded-2xl border border-slate-700 bg-slate-950 p-4 text-white shadow-2xl">
      <p className="text-sm font-semibold">Install Mumega Portal</p>
      <p className="mt-1 text-xs text-slate-300">Add the portal to your home screen for faster customer access.</p>
      <div className="mt-3 flex gap-2">
        <button className="rounded-lg bg-white px-3 py-2 text-sm font-medium text-slate-950" onClick={install}>Install</button>
        <button className="rounded-lg px-3 py-2 text-sm text-slate-300" onClick={dismiss}>Not now</button>
      </div>
    </div>
  )
}
