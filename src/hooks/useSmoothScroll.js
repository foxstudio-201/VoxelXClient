/**
 * Smooth scroll — ease-to-target.
 * Mỗi nấc wheel thêm vào target, animation lerp từ current → target,
 * giảm dần và dừng chính xác tại target.
 * Cảm giác: trượt mượt, giảm dần, không overshoot.
 */

export function initGlobalSmoothScroll() {
  // Pixel mỗi nấc wheel (deltaY thường = 100 hoặc 120)
  const STEP   = 100
  // Lerp factor mỗi frame: 0.12 = mượt vừa (~350ms để đến đích)
  const LERP   = 0.12
  // Dừng khi còn cách đích < ngưỡng này
  const SNAP   = 0.5

  const states = new WeakMap()

  function getState(el) {
    if (!states.has(el)) {
      states.set(el, {
        current: el.scrollTop,
        target:  el.scrollTop,
        rafId:   null,
      })
    }
    return states.get(el)
  }

  function getScrollParent(el) {
    let node = el
    while (node && node !== document.documentElement) {
      const ov = window.getComputedStyle(node).overflowY
      if ((ov === 'auto' || ov === 'scroll') && node.scrollHeight > node.clientHeight + 1)
        return node
      node = node.parentElement
    }
    return null
  }

  function tick(el) {
    const s   = states.get(el)
    if (!s) return

    const dist = s.target - s.current

    if (Math.abs(dist) < SNAP) {
      // Snap đến đích chính xác
      s.current  = s.target
      el.scrollTop = s.target
      s.rafId    = null
      return
    }

    // Lerp: tiến gần target theo tỉ lệ LERP mỗi frame
    s.current   += dist * LERP
    el.scrollTop = s.current
    s.rafId      = requestAnimationFrame(() => tick(el))
  }

  function getScrollParentAndSync(el) {
    const scrollEl = getScrollParent(el)
    if (!scrollEl) return null

    // Sync current với scrollTop thực tế (phòng trường hợp user dùng scrollbar)
    const s = getState(scrollEl)
    if (Math.abs(scrollEl.scrollTop - s.current) > 2) {
      s.current = scrollEl.scrollTop
      s.target  = scrollEl.scrollTop
    }
    return scrollEl
  }

  function onWheel(e) {
    if (e.ctrlKey) return
    if (Math.abs(e.deltaX) > Math.abs(e.deltaY)) return

    const scrollEl = getScrollParentAndSync(e.target)
    if (!scrollEl) return

    e.preventDefault()
    e.stopPropagation()

    // Normalize delta → số nấc
    let delta = e.deltaY
    if (e.deltaMode === 1) delta *= 20    // line mode
    if (e.deltaMode === 2) delta *= 300   // page mode

    // Chuẩn hóa về STEP pixel mỗi nấc
    // deltaY thường là 100 hoặc 120 → normalize về 1 nấc = STEP px
    const normalized = (delta / 100) * STEP

    const s   = getState(scrollEl)
    const max = scrollEl.scrollHeight - scrollEl.clientHeight

    s.target = Math.max(0, Math.min(max, s.target + normalized))

    if (!s.rafId) {
      s.rafId = requestAnimationFrame(() => tick(scrollEl))
    }
  }

  document.addEventListener('wheel', onWheel, { passive: false })
  return () => document.removeEventListener('wheel', onWheel)
}

export function useSmoothScroll() {}
