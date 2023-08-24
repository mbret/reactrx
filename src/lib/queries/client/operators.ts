import { type Observable, distinctUntilChanged, scan } from "rxjs"
import { shallowEqual } from "../../utils/shallowEqual"
import { type QueryOptions, type QueryResult } from "./types"
import { retryBackoff } from "../../utils/retryBackoff"

export const retryOnError = <T>(options: Pick<QueryOptions<T>, "retry">) =>
  retryBackoff({
    initialInterval: 100,
    ...(typeof options.retry === "function"
      ? {
          shouldRetry: options.retry
        }
      : {
          maxRetries: options.retry === false ? 0 : options.retry ?? 3
        })
  })

export const mergeResults = <T>(
  stream$: Observable<Partial<QueryResult<T>>>
): Observable<QueryResult<T>> =>
  stream$.pipe(
    scan(
      (acc: QueryResult<T>, current) => {
        return {
          ...acc,
          ...current
        }
      },
      {
        data: undefined,
        error: undefined,
        fetchStatus: "idle",
        status: "loading"
      }
    ),
    distinctUntilChanged(
      ({ data: prevData, ...prev }, { data: currData, ...curr }) =>
        shallowEqual(prev, curr) && shallowEqual(prevData, currData)
    )
  )
