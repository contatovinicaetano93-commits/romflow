"use client";

import { useEffect, useRef, useState } from "react";
import { Plus } from "lucide-react";
import { AREA_LABEL, cls } from "@/lib/format";
import type { Screen, User } from "@/lib/types";
import { newRequestScreen, screenForNewArea, userAreas } from "@/lib/workflow";

export function NewRequestButton({
  user,
  onNavigate,
  className = "primary-button",
  label = "Nova solicitação",
}: {
  user: User;
  onNavigate: (screen: Screen) => void;
  className?: string;
  label?: string;
}) {
  const areas = userAreas(user);
  const [open, setOpen] = useState(false);
  const wrapRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) {
      return;
    }
    function onPointer(event: Event) {
      if (wrapRef.current && !wrapRef.current.contains(event.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("pointerdown", onPointer);
    return () => document.removeEventListener("pointerdown", onPointer);
  }, [open]);

  if (areas.length <= 1) {
    return (
      <button type="button" className={className} onClick={() => onNavigate(newRequestScreen(user))}>
        <Plus size={18} /> {label}
      </button>
    );
  }

  return (
    <div className="new-request-picker" ref={wrapRef}>
      <button
        type="button"
        className={cls(className, open && "open")}
        aria-expanded={open}
        aria-haspopup="menu"
        onClick={() => setOpen((value) => !value)}
      >
        <Plus size={18} /> {label}
      </button>
      {open ? (
        <div className="new-request-menu" role="menu">
          {areas.map((area) => (
            <button
              key={area}
              type="button"
              role="menuitem"
              onClick={() => {
                setOpen(false);
                onNavigate(screenForNewArea(area));
              }}
            >
              {AREA_LABEL[area]}
            </button>
          ))}
        </div>
      ) : null}
    </div>
  );
}
