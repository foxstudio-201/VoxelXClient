/**
 * VoxelXClient — Minecraft Launcher
 * Created by FoxStudio. AI-assisted development.
 *
 * Source code : https://github.com/foxstudio-201/VoxelXClient
 * Website     : https://voxxelxclient.vercel.app
 *
 * NOTICE:
 *   - This software is provided as-is without warranty of any kind.
 *   - Do not redistribute or resell without explicit permission from FoxStudio.
 *   - If you use or reference this code, please credit FoxStudio.
 *   - Minecraft is a trademark of Mojang Studios / Microsoft. This project is not affiliated with Mojang.
 */

import { useState, useEffect, useCallback, createContext, useContext } from 'react'
import { offlineUUID } from '../utils/offlineUUID'

const isElectron = typeof window !== 'undefined' && window.electronAPI

const localFallback = {
  get: () => {
    try { return JSON.parse(localStorage.getItem('vxc_accounts') || '{"accounts":[],"selectedId":null}') }
    catch { return { accounts: [], selectedId: null } }
  },
  set: (data) => localStorage.setItem('vxc_accounts', JSON.stringify(data)),
}

export const AccountsContext = createContext(null)

export function AccountsProvider({ children }) {
  const [accounts, setAccounts]     = useState([])
  const [selectedId, setSelectedId] = useState(null)
  const [loading, setLoading]       = useState(true)

  useEffect(() => {
    async function load() {
      const data = isElectron
        ? await window.electronAPI.getAccounts()
        : localFallback.get()
      setAccounts(data.accounts)
      setSelectedId(data.selectedId)
      setLoading(false)
    }
    load()
  }, [])

  const addAccount = useCallback(async (account) => {

    if (account._msAlreadySaved) {
      const data = isElectron
        ? await window.electronAPI.getAccounts()
        : localFallback.get()
      setAccounts(data.accounts)
      setSelectedId(data.selectedId)
      return { ok: true, data }
    }

    const uuid = account.type === 'offline'
      ? offlineUUID(account.username)
      : crypto.randomUUID()
    const newAccount = {
      id: uuid, uuid, createdAt: new Date().toISOString(), ...account,
    }
    let result
    if (isElectron) {
      result = await window.electronAPI.addAccount(newAccount)
    } else {
      const data = localFallback.get()
      const exists = data.accounts.find(a => a.username === newAccount.username && a.type === newAccount.type)
      if (exists) return { error: 'Tai khoan da ton tai' }
      data.accounts.push(newAccount)
      if (!data.selectedId) data.selectedId = newAccount.id
      localFallback.set(data)
      result = { ok: true, data }
    }
    if (result.error) return result
    setAccounts(result.data.accounts)
    setSelectedId(result.data.selectedId)
    return result
  }, [])

  const removeAccount = useCallback(async (id) => {
    let result
    if (isElectron) {
      result = await window.electronAPI.removeAccount(id)
    } else {
      const data = localFallback.get()
      data.accounts = data.accounts.filter(a => a.id !== id)
      if (data.selectedId === id) data.selectedId = data.accounts[0]?.id ?? null
      localFallback.set(data)
      result = { ok: true, data }
    }
    setAccounts(result.data.accounts)
    setSelectedId(result.data.selectedId)
  }, [])

  const selectAccount = useCallback(async (id) => {
    let result
    if (isElectron) {
      result = await window.electronAPI.selectAccount(id)
    } else {
      const data = localFallback.get()
      data.selectedId = id
      localFallback.set(data)
      result = { ok: true, data }
    }
    setSelectedId(result.data.selectedId)
  }, [])

  const selectedAccount = accounts.find(a => a.id === selectedId) ?? null

  return (
    <AccountsContext.Provider value={{
      accounts, selectedId, selectedAccount, loading,
      addAccount, removeAccount, selectAccount,
    }}>
      {children}
    </AccountsContext.Provider>
  )
}

export function useAccounts() {
  const ctx = useContext(AccountsContext)
  if (!ctx) throw new Error('useAccounts must be used inside AccountsProvider')
  return ctx
}

