"""Pairing state machine.

    proving_run -> active -> released
    proving_run -> lapsed
    active -> completed

Clients never set state. Services raise an event and get the next state or
an IllegalTransition.
"""

EVENTS = ("convert", "release", "lapse", "complete")
STATES = ("proving_run", "active", "released", "lapsed", "completed")
TERMINAL = frozenset({"released", "lapsed", "completed"})

_TRANSITIONS: dict[str, dict[str, str]] = {
    "proving_run": {"convert": "active", "lapse": "lapsed"},
    "active": {"release": "released", "complete": "completed"},
    "released": {},
    "lapsed": {},
    "completed": {},
}


class IllegalTransition(Exception):
    def __init__(self, state: str, event: str) -> None:
        super().__init__(f'Cannot apply "{event}" to a pairing in state "{state}"')
        self.state = state
        self.event = event


def can_transition(state: str, event: str) -> bool:
    return event in _TRANSITIONS.get(state, {})


def next_state(state: str, event: str) -> str:
    try:
        return _TRANSITIONS[state][event]
    except KeyError as exc:
        raise IllegalTransition(state, event) from exc


def is_terminal(state: str) -> bool:
    return state in TERMINAL