import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { Action } from "./delivery";
import { createFixtureRepository, type RiderState } from "./repository";

/** Swap for an HTTP repository backed by the delivery service when it exists. */
export const repository = createFixtureRepository();

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
