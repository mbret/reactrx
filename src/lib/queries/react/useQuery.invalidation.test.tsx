import { afterEach, describe, expect, it, vi } from "vitest"
import { render, cleanup } from "@testing-library/react"
import { useQuery } from "./useQuery"
import { createClient } from "../client/createClient"
import { ReactjrxQueryProvider } from "../../.."
import { waitForTimeout } from "../../../tests/utils"
import { printQuery } from "../../../tests/testUtils"
import { of } from "rxjs"

afterEach(() => {
  cleanup()
})

describe("useQuery", () => {
  describe("Given a query which runs once", () => {
    describe("and the query is a promise", () => {
      describe("when the query finished and is marked as stale", () => {
        it("should refetch", async () => {
          let value = 0
          const queryFn = vi.fn().mockImplementation(async () => ++value)

          const staleTimeout = 1

          const Comp = () => {
            const result = useQuery({
              queryKey: ["foo"],
              queryFn,
              staleTime: staleTimeout
            })

            return <>{result.data}</>
          }

          const client = createClient()

          const { findByText, rerender } = render(
            <ReactjrxQueryProvider client={client}>
              <Comp />
            </ReactjrxQueryProvider>
          )

          expect(await findByText("1")).toBeDefined()

          expect(queryFn.mock.calls.length).toBe(1)

          await waitForTimeout(1)

          rerender(
            <ReactjrxQueryProvider client={client}>
              unmounted query
            </ReactjrxQueryProvider>
          )

          rerender(
            <ReactjrxQueryProvider client={client}>
              <Comp />
            </ReactjrxQueryProvider>
          )

          expect(await findByText("2")).toBeDefined()

          expect(queryFn.mock.calls.length).toBe(2)
        })
      })

      describe("when the query finished and is not marked as stale", () => {
        it("should not refetch", async () => {
          let value = 0
          const queryFn = vi.fn().mockImplementation(async () => ++value)

          const staleTimeout = Infinity

          const Comp = () => {
            const { data, status } = useQuery({
              queryKey: ["foo"],
              queryFn,
              staleTime: staleTimeout
            })

            return <>{printQuery({ data, status })}</>
          }

          const client = createClient()

          const { findByText, rerender } = render(
            <ReactjrxQueryProvider client={client}>
              <Comp />
            </ReactjrxQueryProvider>
          )

          expect(
            await findByText(printQuery({ data: 1, status: "success" }))
          ).toBeDefined()

          expect(queryFn.mock.calls.length).toBe(1)

          await waitForTimeout(1)

          rerender(
            <ReactjrxQueryProvider client={client}>
              unmounted query
            </ReactjrxQueryProvider>
          )

          rerender(
            <ReactjrxQueryProvider client={client}>
              <Comp />
            </ReactjrxQueryProvider>
          )

          expect(
            await findByText(printQuery({ data: 1, status: "success" }))
          ).toBeDefined()

          expect(queryFn.mock.calls.length).toBe(1)
        })
      })
    })

    describe("and the query is an observable", () => {
      describe("when the query finished and is marked as stale", () => {
        it("should refetch", async () => {
          let value = 0

          const queryFn = vi.fn().mockImplementation(() => {
            return of(++value)
          })

          const staleTimeout = 1

          const Comp = () => {
            const result = useQuery({
              queryKey: ["foo"],
              queryFn,
              staleTime: staleTimeout
            })

            return (
              <>{printQuery({ status: result.status, data: result.data })}</>
            )
          }

          const client = createClient()

          const { findByText, rerender } = render(
            <ReactjrxQueryProvider client={client}>
              <Comp />
            </ReactjrxQueryProvider>
          )

          expect(
            await findByText(printQuery({ data: 1, status: "success" }))
          ).toBeDefined()

          expect(queryFn.mock.calls.length).toBe(1)

          rerender(
            <ReactjrxQueryProvider client={client}>
              unmounted query
            </ReactjrxQueryProvider>
          )

          rerender(
            <ReactjrxQueryProvider client={client}>
              <Comp />
            </ReactjrxQueryProvider>
          )

          expect(await findByText(printQuery({ data: 2, status: "success" }))).toBeDefined()

          expect(queryFn.mock.calls.length).toBe(2)
        })
      })

      describe("when the query take longer than the stale timeout", () => {
        it("should not refetch", async () => {
          const queryFn = vi.fn().mockImplementation(() => undefined)
          const staleTimeout = 1

          const Comp = () => {
            useQuery({ queryFn, staleTime: staleTimeout })

            return null
          }

          const client = createClient()

          render(
            <ReactjrxQueryProvider client={client}>
              <Comp />
            </ReactjrxQueryProvider>
          )

          expect(queryFn).toHaveBeenCalledTimes(1)
        })
      })
    })
  })
})
