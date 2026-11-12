import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import {
  createInMemoryOrderRepository,
  statusAt,
  type Order,
  type PlaceOrderInput,
} from "./orders";
import { makeSeedOrders } from "./orderSeed";

/** Swap for an HTTP repository backed by the order service when it exists. */
export const orderRepository = createInMemoryOrderRepository({ seed: makeSeedOrders() });

const inFlight = (order: Order) => {
  const status = statusAt(order, new Date());
  return status !== "delivered" && status !== "cancelled";
};

export function useOrders() {
  return useQuery({
    queryKey: ["orders"],
    queryFn: () => orderRepository.list(),
    refetchInterval: (query) => (query.state.data?.some(inFlight) ? 3000 : false),
  });
}

export function useOrder(id: string | undefined) {
  return useQuery({
    queryKey: ["orders", id],
    enabled: Boolean(id),
    queryFn: async () => orderRepository.get(id as string),
    refetchInterval: (query) => (query.state.data && inFlight(query.state.data) ? 3000 : false),
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
