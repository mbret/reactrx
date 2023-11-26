import {
  BehaviorSubject,
  Subject,
  catchError,
  combineLatest,
  concatMap,
  defer,
  distinctUntilChanged,
  filter,
  finalize,
  from,
  identity,
  map,
  merge,
  mergeMap,
  of,
  share,
  skip,
  startWith,
  switchMap,
  take,
  takeUntil,
  tap
} from "rxjs"
import { isDefined } from "../../../utils/isDefined"
import { retryOnError } from "../operators"
import { type MutationOptions, type MutationResult } from "./types"
import { mergeResults } from "./operators"

export const createMutationRunner = <T, MutationArg>() => {
  const trigger$ = new Subject<{
    args: MutationArg
    options: MutationOptions<T, MutationArg>
  }>()
  const reset$ = new Subject<void>()
  let closed = false
  const initOptions$ = new BehaviorSubject<
    Pick<
      MutationOptions<any, any>,
      "mapOperator" | "__queryInitHook" | "__queryTriggerHook"
    >
  >({
    mapOperator: "merge"
  })
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

    initOptions$.complete()
    mutationsRunning$.complete()
    trigger$.complete()
    reset$.complete()
  }

  const mapOperator$ = initOptions$.pipe(
    map(({ mapOperator }) => mapOperator),
    filter(isDefined),
    distinctUntilChanged()
  )

  const mutation$ = mapOperator$.pipe(
    switchMap((options) =>
      of(options).pipe(
        (initOptions$.getValue().__queryInitHook as typeof identity) ?? identity
      )
    ),
    mergeMap((mapOperator) => {
      const switchOperator =
        mapOperator === "concat"
          ? concatMap
          : mapOperator === "switch"
            ? switchMap
            : mergeMap

      return trigger$.pipe(
        takeUntil(mapOperator$.pipe(skip(1))),
        tap(() => {
          mutationsRunning$.next(mutationsRunning$.getValue() + 1)
        }),
        mergeMap(({ args, options }) =>
          of({ args, options }).pipe(
            (initOptions$.getValue().__queryInitHook as typeof identity) ??
              identity
          )
        ),
        switchOperator(({ args, options }) => {
          const queryRunner$ = defer(() => from(options.mutationFn(args))).pipe(
            retryOnError(options),
            take(1),
            map((data) => ({ data, isError: false })),
            catchError((error: unknown) => {
              console.error(error)

              if (options.onError != null) {
                options.onError(error, args)
              }

              return of({ data: error, isError: true })
            }),
            share()
          )

          const queryIsOver$ = queryRunner$.pipe(
            map(({ data, isError }) => isError || data)
          )

          const isThisCurrentFunctionLastOneCalled = trigger$.pipe(
            take(1),
            map(() => mapOperator === "concat"),
            startWith(true),
            takeUntil(queryIsOver$)
          )

          const loading$ = of<Partial<MutationResult<T>>>({
            status: "loading"
          })

          return merge(
            loading$,
            combineLatest([
              queryRunner$,
              isThisCurrentFunctionLastOneCalled
            ]).pipe(
              map(([{ data, isError }, isLastMutationCalled]) => {
                if (!isError) {
                  if (options.onSuccess != null)
                    options.onSuccess(data as T, args)
                }

                if (isLastMutationCalled) {
                  return isError
                    ? {
                        status: "error" as const,
                        error: data,
                        data: undefined
                      }
                    : {
                        status: "success" as const,
                        error: undefined,
                        data: data as T
                      }
                }

                return {}
              }),
              takeUntil(reset$)
            )
          ).pipe(
            (options.__queryRunnerHook as typeof identity) ?? identity,
            finalize(() => {
              mutationsRunning$.next(mutationsRunning$.getValue() - 1)
            })
          )
        }),
        (initOptions$.getValue().__queryTriggerHook as typeof identity) ??
          identity,
        mergeResults
      )
    })
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
      initOptions$.next({
        __queryInitHook: options.__queryInitHook,
        __queryTriggerHook: options.__queryTriggerHook,
        mapOperator: options.mapOperator
      })

      trigger$.next({ args, options })
    },
    reset$,
    destroy,
    mutationsRunning$,
    getClosed: () => closed
  }
}
