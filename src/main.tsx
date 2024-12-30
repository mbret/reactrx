/* eslint-disable @typescript-eslint/non-nullable-type-assertion-style */
/* eslint-disable @typescript-eslint/no-unused-vars */
/* eslint-disable new-cap */
import { memo, StrictMode, useState } from "react"
import ReactDOM from "react-dom/client"
import {
  QueryClient as rc_QueryClient,
  QueryClientProvider as RcQueryClientProvider,
  MutationCache as RQMutationCache
} from "@tanstack/react-query"
import { interval, map, timer } from "rxjs"
import { useQuery$ } from "./lib/queries/useQuery$"
import { QueryClientProvider$ } from "./lib/queries/QueryClientProvider$"
import { useContactMutation$ } from "./lib/queries/useConcatMutation$"

const rcClient = new rc_QueryClient({
  mutationCache: new RQMutationCache({
    onError: (error) => {
      console.log("cache onError", error)
    }
  })
})

const Foo = memo(() => {
  const data = useQuery$({ queryKey: ["foo"], queryFn: () => timer(99999) })

  console.log({ ...data })

  return null
})

let t = 0

const App = memo(() => {
  const [hide, setHide] = useState(false)

  const { mutate, data, ...rest } = useContactMutation$({
    mutationKey: ["foo"],
    mutationFn: (v: number) => {
      console.log("mutationFn", v)

      return interval(Math.floor(Math.random() * 2000) + 1).pipe(
        map(() => {
          console.log("FOOO result", v)

          return v
        })
      )
    }
  })

  console.log({ ...rest })

  return (
    <>
      {/* <div>{data.data ?? 0}</div> */}
      <button
        onClick={() => {
          setHide((v) => !v)
        }}
      >
        toggle hide
      </button>
      <button
        onClick={() => {
          t++
          console.log("FOOO trigger", t)

          mutate(t)
        }}
      >
        mutate {data}
      </button>
      <button onClick={() => rcClient.cancelQueries({ queryKey: ["foo"] })}>
        cancel query
      </button>
      {hide ? <div>hidden</div> : <Foo />}
    </>
  )
})

ReactDOM.createRoot(document.getElementById("app") as HTMLElement).render(
  <StrictMode>
    <RcQueryClientProvider client={rcClient}>
      <QueryClientProvider$>
        <App />
      </QueryClientProvider$>
    </RcQueryClientProvider>
  </StrictMode>
)
