"use client";

import { useState } from "react";
import type { ExcPartInfo } from "@/components/visualizer/exc-bike";

export function BikePartsPanel({
  parts,
  hidden,
  onToggle,
  onToggleAssembly,
  onShowAll,
  onStrip,
  riderOn,
  onToggleRider,
}: {
  parts: ExcPartInfo[];
  hidden: Set<string>;
  onToggle: (id: string) => void;
  onToggleAssembly: (assembly: string) => void;
  onShowAll: () => void;
  onStrip: () => void;
  riderOn: boolean;
  onToggleRider: () => void;
}) {
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set());

  const groups: { assembly: string; parts: ExcPartInfo[] }[] = [];
  for (const part of parts) {
    const last = groups[groups.length - 1];
    if (last && last.assembly === part.assembly) last.parts.push(part);
    else groups.push({ assembly: part.assembly, parts: [part] });
  }
  const shown = parts.filter((part) => !hidden.has(part.id)).length;

  const toggleCollapsed = (assembly: string) => {
    setCollapsed((current) => {
      const next = new Set(current);
      if (next.has(assembly)) next.delete(assembly);
      else next.add(assembly);
      return next;
    });
  };

  return (
    <div className="grid gap-1.5">
      <div className="flex items-center justify-between gap-2">
        <p className="text-[10px] font-medium tracking-wide text-muted-foreground uppercase">
          Bike parts
        </p>
        <div className="flex items-center gap-2">
          <button
            type="button"
            className="text-[10px] text-amber-200/90"
            onClick={onToggleRider}
          >
            Rider {riderOn ? "on" : "off"}
          </button>
          <button type="button" className="text-[10px] text-amber-200/90" onClick={onStrip}>
            Strip
          </button>
          <button type="button" className="text-[10px] text-amber-200/90" onClick={onShowAll}>
            Show all
          </button>
        </div>
      </div>

      {parts.length === 0 ? (
        <p className="text-[11px] text-muted-foreground">Loading the bike…</p>
      ) : (
        <>
          <p className="font-mono text-[10px] text-muted-foreground">
            {shown} of {parts.length} on
          </p>
          {groups.map((group) => {
            const hiddenCount = group.parts.filter((part) => hidden.has(part.id)).length;
            const allHidden = hiddenCount === group.parts.length;
            const isCollapsed = collapsed.has(group.assembly);
            return (
              <div key={group.assembly} className="grid gap-0.5">
                <div className="flex items-center justify-between gap-1">
                  <button
                    type="button"
                    className="flex min-w-0 flex-1 items-center gap-1 text-left text-[10px] font-medium text-amber-100/80"
                    onClick={() => toggleCollapsed(group.assembly)}
                    aria-expanded={!isCollapsed}
                  >
                    <span className="font-mono text-muted-foreground">{isCollapsed ? "+" : "−"}</span>
                    <span className="truncate">{group.assembly}</span>
                    <span className="font-mono text-[10px] text-muted-foreground">
                      {group.parts.length - hiddenCount}/{group.parts.length}
                    </span>
                  </button>
                  <button
                    type="button"
                    className="font-mono text-[10px] text-muted-foreground"
                    onClick={() => onToggleAssembly(group.assembly)}
                  >
                    {allHidden ? "off" : "on"}
                  </button>
                </div>
                {isCollapsed
                  ? null
                  : group.parts.map((part) => {
                      const off = hidden.has(part.id);
                      return (
                        <button
                          key={part.id}
                          type="button"
                          className={`flex w-full items-center justify-between rounded px-1.5 py-0.5 text-left text-[11px] ${
                            off ? "text-muted-foreground line-through" : "text-foreground"
                          }`}
                          onClick={() => onToggle(part.id)}
                          aria-pressed={!off}
                        >
                          <span className="truncate">{part.label}</span>
                          <span className="font-mono text-[10px] text-muted-foreground">
                            {off ? "hide" : "show"}
                          </span>
                        </button>
                      );
                    })}
              </div>
            );
          })}
        </>
      )}
    </div>
  );
}
