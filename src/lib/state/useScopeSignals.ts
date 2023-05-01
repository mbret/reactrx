import { useLiveRef } from "../utils/useLiveRef"
import { useEffect } from "react"
import { Signal } from "./signal"
import { SIGNAL_RESET } from "./constants"

/**
 * Will reset signals when the scope is unmounted
 */
export const useScopeSignals = (signals: Signal<any>[]) => {
  const signalsRef = useLiveRef(signals)

  useEffect(
    () => () => {
      signalsRef.current.forEach(({ setState }) => setState(SIGNAL_RESET))
    },
    []
  )
}
