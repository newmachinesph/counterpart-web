import pytest

from app.domain.pairing import EVENTS, STATES, IllegalTransition, can_transition, is_terminal, next_state

LEGAL = {("proving_run", "convert"): "active", ("proving_run", "lapse"): "lapsed", ("active", "release"): "released", ("active", "complete"): "completed"}


@pytest.mark.parametrize("state,event", [(s, e) for s in STATES for e in EVENTS])
def test_every_state_event_pair(state, event):
    if (state, event) in LEGAL:
        assert can_transition(state, event)
        assert next_state(state, event) == LEGAL[(state, event)]
    else:
        assert not can_transition(state, event)
        with pytest.raises(IllegalTransition):
            next_state(state, event)


def test_legal_table_is_exactly_four():
    legal = [(s, e) for s in STATES for e in EVENTS if can_transition(s, e)]
    assert len(legal) == 4


def test_terminal_states():
    assert all(is_terminal(s) for s in ("released", "lapsed", "completed"))
    assert not is_terminal("proving_run") and not is_terminal("active")