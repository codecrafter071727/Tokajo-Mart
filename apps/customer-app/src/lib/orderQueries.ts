import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import {
  createInMemoryOrderRepository,
  statusAt,
  type Order,
  type PlaceOrderInput,
} from "./orders";
import { makeSeedOrders } from "./orderSeed";
import { createHttpOrderRepository } from "./httpOrders";
import { backendEnabled } from "./session";

/** The order service when a gateway is configured, otherwise the demo orders that run on the clock. */
export const orderRepository = backendEnabled
  ? createHttpOrderRepository()
  : createInMemoryOrderRepository({ seed: makeSeedOrders() });

// Real orders change when the warehouse and rider act, so poll a little slower than the demo clock
const POLL_MS = backendEnabled ? 5000 : 3000;

const inFlight = (order: Order) => {
  const status = statusAt(order, new Date());
  return status !== "delivered" && status !== "cancelled";
};

export function useOrders() {
  return useQuery({
    queryKey: ["orders"],
    queryFn: () => orderRepository.list(),
    refetchInterval: (query) => (query.state.data?.some(inFlight) ? POLL_MS : false),
  });
}

export function useOrder(id: string | undefined) {
  return useQuery({
    queryKey: ["orders", id],
    enabled: Boolean(id),
    queryFn: async () => orderRepository.get(id as string),
    refetchInterval: (query) => (query.state.data && inFlight(query.state.data) ? POLL_MS : false),
  });
}

export function useCancelOrder() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => {
      if (!orderRepository.cancel) throw new Error("Cancelling is not available.");
      return orderRepository.cancel(id);
    },
    onSuccess: () => client.invalidateQueries({ queryKey: ["orders"] }),
  });
}

export function usePlaceOrder() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: (input: PlaceOrderInput) => orderRepository.place(input),
    onSuccess: () => client.invalidateQueries({ queryKey: ["orders"] }),
  });
}

/** Re-renders every `ms` so countdowns and the timeline move without any data refetch. */
export function useNow(ms = 1000): Date {
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const timer = setInterval(() => setNow(new Date()), ms);
    return () => clearInterval(timer);
  }, [ms]);
  return now;
}
