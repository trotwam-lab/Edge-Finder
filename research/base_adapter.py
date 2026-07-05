"""
EdgeFinder Research Layer — base adapter architecture.

One abstraction rules everything: every sport is a SportAdapter built from
the registry config. The engine never knows what sport it's running — it only
knows cadence, slots, and gates.

    Registry (JSON)  ->  SportAdapter  ->  RefreshEngine  ->  PublishGate

Adding a sport = adding a registry entry. Zero new engine code unless the
sport introduces a brand-new availability primitive (rare).
"""

from __future__ import annotations

import json
from abc import ABC, abstractmethod
from dataclasses import dataclass, field
from datetime import datetime, timedelta
from enum import Enum
from pathlib import Path
from typing import Any


# ---------------------------------------------------------------------------
# Core enums — the vocabulary the whole layer speaks
# ---------------------------------------------------------------------------

class Cadence(str, Enum):
    DAILY = "daily"      # MLB, KBO, NBA — season-long, games most days
    WEEKLY = "weekly"    # soccer, NFL — season-long, clustered match days
    EVENT = "event"      # MMA, tennis, golf — discrete cards/tournaments


class AvailabilityPrimitive(str, Enum):
    """What 'is this participant playing?' means in each sport."""
    CONFIRMED_LINEUPS = "confirmed_lineups"    # MLB, KBO
    INJURY_REPORT = "injury_report"            # NBA, NFL
    CONFIRMED_XI = "confirmed_xi"              # soccer
    WITHDRAWAL_WATCH = "withdrawal_watch"      # tennis
    WEIGH_IN_WATCH = "weigh_in_watch"          # MMA


class GateStatus(str, Enum):
    OPEN = "open"                # gate cleared — edge can publish as final
    PENDING = "pending"          # gate event hasn't happened yet
    FLAGGED = "flagged"          # gate event happened, changed the thesis
    DEGRADED = "degraded"        # gate check couldn't run (source down)


# ---------------------------------------------------------------------------
# Slot dataclasses — mirror the registry JSON
# ---------------------------------------------------------------------------

@dataclass
class SourceRef:
    source: str
    path: str | None = None
    endpoint: str | None = None
    sport_key: str | None = None
    metrics: list[str] = field(default_factory=list)
    fields: list[str] = field(default_factory=list)
    note: str | None = None

    @classmethod
    def from_dict(cls, d: dict[str, Any] | None) -> "SourceRef | None":
        if not d:
            return None
        known = {k: v for k, v in d.items() if k in cls.__dataclass_fields__}
        return cls(**known)


@dataclass
class FreshnessCheckpoint:
    at: str          # "T-75min", "weigh_ins", "draw_release", cron expr, etc.
    action: str


@dataclass
class FreshnessConfig:
    trigger_type: str                        # cron_plus_gate | relative_to_event | event_lifecycle
    publish_gate: str
    gate_notes: str = ""
    base_refresh: str | None = None          # cron, for daily sports
    checkpoints: list[FreshnessCheckpoint] = field(default_factory=list)


@dataclass
class SportConfig:
    key: str
    display_name: str
    cadence: Cadence
    timezone_anchor: str
    availability_primitive: AvailabilityPrimitive
    schedule_primary: SourceRef
    schedule_secondary: SourceRef | None
    availability_primary: SourceRef
    availability_secondary: SourceRef | None
    availability_fields: list[str]
    sport_specific: dict[str, str]
    form_primary: SourceRef
    form_secondary: SourceRef | None
    freshness: FreshnessConfig

    @classmethod
    def from_registry(cls, key: str, cfg: dict[str, Any]) -> "SportConfig":
        slots = cfg["slots"]
        avail = slots["availability"]
        fresh = slots["freshness"]
        return cls(
            key=key,
            display_name=cfg["display_name"],
            cadence=Cadence(cfg["cadence"]),
            timezone_anchor=cfg["timezone_anchor"],
            availability_primitive=AvailabilityPrimitive(avail["primitive"]),
            schedule_primary=SourceRef.from_dict(slots["schedule"]["primary"]),
            schedule_secondary=SourceRef.from_dict(slots["schedule"].get("secondary")),
            availability_primary=SourceRef.from_dict(avail["primary"]),
            availability_secondary=SourceRef.from_dict(avail.get("secondary")),
            availability_fields=avail.get("fields", []),
            sport_specific=avail.get("sport_specific", {}),
            form_primary=SourceRef.from_dict(slots["form"]["primary"]),
            form_secondary=SourceRef.from_dict(slots["form"].get("secondary")),
            freshness=FreshnessConfig(
                trigger_type=fresh["trigger_type"],
                publish_gate=fresh["publish_gate"],
                gate_notes=fresh.get("gate_notes", ""),
                base_refresh=fresh.get("base_refresh"),
                checkpoints=[FreshnessCheckpoint(**c) for c in fresh.get("checkpoints", [])],
            ),
        )


# ---------------------------------------------------------------------------
# The adapter — one class per cadence family, NOT one per sport
# ---------------------------------------------------------------------------

class SportAdapter(ABC):
    """Everything the RefreshEngine needs, regardless of sport."""

    def __init__(self, config: SportConfig):
        self.config = config

    # -- the four slots ----------------------------------------------------

    @abstractmethod
    def fetch_schedule(self, window_hours: int = 48) -> list[dict]:
        """Upcoming games/matches/bouts in the window. Odds API first."""

    @abstractmethod
    def fetch_availability(self, event_id: str) -> dict:
        """Resolve the sport's availability primitive for one event."""

    @abstractmethod
    def fetch_form(self, participant_id: str) -> dict:
        """Pull form metrics from the sport's analytics source."""

    # -- the gate ------------------------------------------------------------

    @abstractmethod
    def evaluate_gate(self, event: dict, now: datetime) -> GateStatus:
        """Has the hard-gate event happened, and did it hold the thesis?"""

    # -- shared behavior -----------------------------------------------------

    def stake_adjustment(self, gate: GateStatus) -> float:
        """
        Uniform risk policy across sports:
          OPEN      -> full stake
          PENDING   -> lean only, half stake, 'pending gate' label required
          FLAGGED   -> edge void, do not publish
          DEGRADED  -> half stake + explicit disclaimer (source was down)
        """
        return {
            GateStatus.OPEN: 1.0,
            GateStatus.PENDING: 0.5,
            GateStatus.FLAGGED: 0.0,
            GateStatus.DEGRADED: 0.5,
        }[gate]


class DailySportAdapter(SportAdapter):
    """MLB, KBO, NBA. Morning refresh + confirmation gate near start time."""

    def fetch_schedule(self, window_hours: int = 48) -> list[dict]:
        # -> odds_api.get(self.config.schedule_primary.sport_key)
        raise NotImplementedError("wire to Odds API client")

    def fetch_availability(self, event_id: str) -> dict:
        # -> scrape/pull self.config.availability_primary (Roto lineups page,
        #    MyKBO probables, NBA official injury report)
        raise NotImplementedError("wire to availability client")

    def fetch_form(self, participant_id: str) -> dict:
        raise NotImplementedError("wire to form client")

    def evaluate_gate(self, event: dict, now: datetime) -> GateStatus:
        avail = self.fetch_availability(event["id"])
        if not avail.get("confirmed"):
            return GateStatus.PENDING
        if avail.get("thesis_anchor_scratched"):
            return GateStatus.FLAGGED
        return GateStatus.OPEN


class WeeklySportAdapter(SportAdapter):
    """Soccer, NFL. Checkpoint ladder ending in a hard T-minus gate (T-75 for XIs)."""

    def fetch_schedule(self, window_hours: int = 168) -> list[dict]:
        raise NotImplementedError

    def fetch_availability(self, event_id: str) -> dict:
        raise NotImplementedError

    def fetch_form(self, participant_id: str) -> dict:
        raise NotImplementedError

    def evaluate_gate(self, event: dict, now: datetime) -> GateStatus:
        kickoff = event["start_time"]
        if now < kickoff - timedelta(minutes=75):
            return GateStatus.PENDING          # XI not out yet — leans only
        avail = self.fetch_availability(event["id"])
        if avail.get("source_down"):
            return GateStatus.DEGRADED
        if avail.get("thesis_anchor_benched") or avail.get("unexpected_rotation"):
            return GateStatus.FLAGGED
        return GateStatus.OPEN


class EventSportAdapter(SportAdapter):
    """MMA, tennis, golf. Lifecycle checkpoints (draw release, weigh-ins, T-2h)."""

    def fetch_schedule(self, window_hours: int = 336) -> list[dict]:
        raise NotImplementedError

    def fetch_availability(self, event_id: str) -> dict:
        raise NotImplementedError

    def fetch_form(self, participant_id: str) -> dict:
        raise NotImplementedError

    def evaluate_gate(self, event: dict, now: datetime) -> GateStatus:
        avail = self.fetch_availability(event["id"])
        prim = self.config.availability_primitive
        if prim == AvailabilityPrimitive.WEIGH_IN_WATCH:
            if not avail.get("weigh_in_complete"):
                return GateStatus.PENDING
            if avail.get("weight_miss_severity", 0) >= 2 or avail.get("late_replacement"):
                return GateStatus.FLAGGED
        elif prim == AvailabilityPrimitive.WITHDRAWAL_WATCH:
            if avail.get("news_scan_failed"):
                return GateStatus.DEGRADED     # scan couldn't run -> reduced stake
            if avail.get("withdrawal") or avail.get("retirement_flag"):
                return GateStatus.FLAGGED
        return GateStatus.OPEN


# ---------------------------------------------------------------------------
# Registry loader — cadence decides which adapter class, nothing else does
# ---------------------------------------------------------------------------

_ADAPTER_BY_CADENCE: dict[Cadence, type[SportAdapter]] = {
    Cadence.DAILY: DailySportAdapter,
    Cadence.WEEKLY: WeeklySportAdapter,
    Cadence.EVENT: EventSportAdapter,
}


def load_registry(path: str | Path) -> dict[str, SportAdapter]:
    """Build every adapter from the registry. This is the whole onboarding story:
    new sport in JSON -> adapter exists on next boot."""
    raw = json.loads(Path(path).read_text())
    adapters: dict[str, SportAdapter] = {}
    for key, cfg in raw["sports"].items():
        config = SportConfig.from_registry(key, cfg)
        adapter_cls = _ADAPTER_BY_CADENCE[config.cadence]
        adapters[key] = adapter_cls(config)
    return adapters


if __name__ == "__main__":
    adapters = load_registry(Path(__file__).parent / "sports_registry.json")
    print(f"Loaded {len(adapters)} sports:\n")
    for key, adapter in adapters.items():
        c = adapter.config
        print(f"  {c.display_name:<18} cadence={c.cadence.value:<7} "
              f"primitive={c.availability_primitive.value:<18} "
              f"gate={c.freshness.publish_gate}")
