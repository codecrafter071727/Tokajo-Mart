import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { Action } from "./delivery";
import { REAL_BACKEND } from "./api";
import { createHttpRepository } from "./httpRepository";
import { createFixtureRepository, type RiderState } from "./repository";

/** The delivery service when EXPO_PUBLIC_API_URL is set, otherwise demo data. */
export const repository = REAL_BACKEND ? createHttpRepository() : createFixtureRepository();

const KEY = ["rider", "state"] as const;

/**
 * The rider's whole state. While online it refreshes every few seconds so a new offer shows up
 * without the rider touching anything.
 */
export function useRiderState() {
  return useQuery({
    queryKey: KEY,
    queryFn: () => repository.getState(),
    refetchInterval: (query) => (query.state.data?.online ? 4000 : false),
    staleTime: 0,
  });
}

function useStateMutation<V>(run: (value: V) => Promise<RiderState>) {
  const client = useQueryClient();
  return useMutation({
    mutationFn: run,
    onSuccess: (state) => client.setQueryData(KEY, state),
  });
}

export const useSetOnline = () =>
  useStateMutation((online: boolean) => repository.setOnline(online));

export const useDecline = () =>
  useStateMutation((deliveryId: string) => repository.decline(deliveryId));

export const useDeliveryAction = () =>
  useStateMutation((input: { deliveryId: string; action: Action }) =>
    repository.act(input.deliveryId, input.action),
  );
