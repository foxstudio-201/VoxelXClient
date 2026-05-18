import { createContext, useCallback, useContext, useMemo, useState } from 'react'
import ModpackInstallModal from './ModpackInstallModal'

const ModpackInstallContext = createContext(null)

export function ModpackInstallProvider({ children }) {
  const [session, setSession] = useState(null)

  const openModpackInstall = useCallback(({ project, version, source }) => {
    if (!project || !version) return
    setSession({
      key: `${source || 'modrinth'}:${project?.slug || project?.project_id || project?.id || project?.title || 'modpack'}:${version?.id || version?.version_id || version?.version_number || 'version'}`,
      project,
      version,
      source: source || 'modrinth',
    })
  }, [])

  const closeModpackInstall = useCallback(() => {
    setSession(null)
  }, [])

  const value = useMemo(() => ({
    session,
    openModpackInstall,
    closeModpackInstall,
  }), [session, openModpackInstall, closeModpackInstall])

  return (
    <ModpackInstallContext.Provider value={value}>
      {children}
      {session && (
        <ModpackInstallModal
          key={session.key}
          project={session.project}
          version={session.version}
          source={session.source}
          onClose={closeModpackInstall}
        />
      )}
    </ModpackInstallContext.Provider>
  )
}

export function useModpackInstall() {
  const ctx = useContext(ModpackInstallContext)
  if (!ctx) throw new Error('useModpackInstall must be used within ModpackInstallProvider')
  return ctx
}
