"use client";

import type { AdminOrderDelivery } from "@qc/contracts";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { ImageIcon, MapPin } from "../../../components/ui/icons";
import { gw, GwError } from "../../../lib/gw";

const ageText = (seconds: number) =>
  seconds < 60
    ? `${seconds} s ago`
    : seconds < 3600
      ? `${Math.round(seconds / 60)} min ago`
      : "over an hour ago";

/** The rider's last known position and the door photo, from the delivery service. */
export function DeliveryExtras({ orderId, live }: { orderId: string; live: boolean }) {
  const [open, setOpen] = useState(false);
  const info = useQuery({
    queryKey: ["admin-order-delivery", orderId],
    refetchInterval: live ? 10_000 : false,
    retry: (count, error) => !(error instanceof GwError && error.status === 404) && count < 2,
    queryFn: () => gw<AdminOrderDelivery>("GET", `/v1/delivery/admin/orders/${orderId}`),
  });
  const d = info.data;
  if (!d) return null;
  const loc = d.riderLocation;
  const photo = `/api/v1/delivery/orders/${orderId}/pod`;

  return (
    <div className="mt-4 space-y-3 border-t border-line pt-4 text-[13px]">
      {loc ? (
        <div className="flex items-center justify-between gap-3">
          <span className="flex items-center gap-1.5 text-muted">
            <MapPin className="size-3.5" />
            Last location
            <span
              className={loc.ageSeconds > 120 ? "font-medium text-warn" : "font-medium text-ink"}
            >
              {ageText(loc.ageSeconds)}
            </span>
          </span>
          <a
            href={`https://maps.google.com/?q=${loc.lat},${loc.lng}`}
            target="_blank"
            rel="noreferrer"
            className="font-medium text-accent hover:underline"
          >
            Open
          </a>
        </div>
      ) : live ? (
        <p className="text-muted">The rider has not shared a location yet.</p>
      ) : null}

      {d.podAvailable ? (
        <div>
          <button
            type="button"
            onClick={() => setOpen((v) => !v)}
            className="flex items-center gap-1.5 font-medium text-accent hover:underline"
            aria-expanded={open}
          >
            <ImageIcon className="size-3.5" />
            {open ? "Hide door photo" : "Door photo"}
          </button>
          {open ? (
            <a href={photo} target="_blank" rel="noreferrer" className="mt-2 block">
              <img
                src={photo}
                alt="Photo the rider took at the door"
                className="aspect-[4/3] w-full rounded-lg border border-line object-cover"
              />
            </a>
          ) : null}
        </div>
      ) : d.status === "delivered" ? (
        <p className="text-muted">No door photo was added.</p>
      ) : null}
    </div>
  );
}
