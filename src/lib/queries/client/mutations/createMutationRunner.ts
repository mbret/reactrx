/* eslint-disable @typescript-eslint/naming-convention */
import {
  BehaviorSubject,
  Subject,
  concatMap,
  distinctUntilChanged,
  filter,
  finalize,
  identity,
  mergeMap,
  skip,
  switchMap,
  takeUntil,
  tap
} from "rxjs"
import { isDefined } from "../../../utils/isDefined"
import {
  type MutationOptions,
} from "./types"
import { mergeResults } from "./operators"
import { createMutation } from "./createMutation"

export type MutationRunner = ReturnType<typeof createMutationRunner>

export const createMutationRunner = <T, MutationArg>({
  __queryFinalizeHook,
  __queryInitHook,
  __queryTriggerHook
}: Pick<
  MutationOptions<any, any>,
  "__queryInitHook" | "__queryTriggerHook" | "__queryFinalizeHook"
>) => {
  const trigger$ = new Subject<{
    args: MutationArg
    options: MutationOptions<T, MutationArg>
  }>()
  const reset$ = new Subject<void>()
  let closed = false
  const mapOperator$ = new BehaviorSubject<
    MutationOptions<any, any>["mapOperator"]
  >("merge")
  const mutationsRunning$ = new BehaviorSubject(0)

  /**
   * Mutation can be destroyed in two ways
   * - caller unsubscribe to the mutation
   * - caller call destroy directly
   */
  const destroy = () => {
    if (closed) {
      throw new Error("Trying to close an already closed mutation")
    }

    closed = true

    mapOperator$.complete()
    mutationsRunning$.complete()
    trigger$.complete()
    reset$.complete()
  }

  const stableMapOperator$ = mapOperator$.pipe(
    filter(isDefined),
    distinctUntilChanged()
  )

  const mutation$ = stableMapOperator$.pipe(
    (__queryInitHook as typeof identity) ?? identity,
    mergeMap((mapOperator) => {
      const switchOperator =
        mapOperator === "concat"
          ? concatMap
          : mapOperator === "switch"
            ? switchMap
            : mergeMap

      return trigger$.pipe(
        takeUntil(stableMapOperator$.pipe(skip(1))),
        tap(() => {
          mutationsRunning$.next(mutationsRunning$.getValue() + 1)
        }),
        switchOperator(({ args, options }) => {
          const mutation$ = createMutation({
            args,
            ...options,
            mapOperator,
            trigger$,
          })

          return mutation$.pipe(
            takeUntil(reset$),
            finalize(() => {
              mutationsRunning$.next(mutationsRunning$.getValue() - 1)
            })
          )
        }),
        (__queryTriggerHook as typeof identity) ?? identity,
        mergeResults
      )
    }),
    (__queryFinalizeHook as typeof identity) ?? identity
  )

  return {
    mutation$,
    trigger: ({
      args,
      options
    }: {
      args: MutationArg
      options: MutationOptions<T, MutationArg>
    }) => {
      mapOperator$.next(options.mapOperator)
      trigger$.next({ args, options })
    },
    reset$,
    destroy,
    mutationsRunning$,
    getClosed: () => closed
  }
}
