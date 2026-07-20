import { useAccounts } from '../hooks/useAccounts'
import GamingHomePage from './gaming/GamingHomePage'

export default function HomePage({ onNavigate, launchState, progress, launchError, onLaunch, onLaunchReset, activePage, onOpenSettings, instances, onKillInstance, onLogPanelOpen }) {
  const { selectedAccount } = useAccounts()

  return (
    <div className="w-full h-full overflow-hidden">
      <GamingHomePage
        onNavigate={onNavigate}
        launchState={launchState}
        progress={progress}
        launchError={launchError}
        onLaunch={onLaunch}
        onLaunchReset={onLaunchReset}
        instances={instances || []}
        onKillInstance={onKillInstance}
        accountId={selectedAccount?.id}
        activePage={activePage}
        onOpenSettings={onOpenSettings}
        onLogPanelOpen={onLogPanelOpen}
      />
    </div>
  )
}
