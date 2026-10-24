# input-binding - Vision

**Status: ratified by the director as written, 2026-10-20 (draw's ruling `H26-6`, in draw's `dev/DECISIONS.md`); amended 2026-10-24 to absorb draw's ruling `H26-14` -- the session keeping the keys held and telling pointers apart, and resolving a press in one call that asks the application for the press's match; enduring.**\
This document states why input-binding exists and what it will never be.\
It carries no current state, no roadmap, and no schedule.

Holding this document authorises nothing.\
A change of direction is recorded as a decision first and absorbed here afterwards.

---

**North star.**\
Let every application decide what an input means in one place, from rows it declares, the same way every time.

**Why it exists.**\
Applications decide what a key or a press means in ladders of `if` branches, where the order is the meaning and a check placed one line too low lets a locked client write, and they decide "click or drag", and which release ends a gesture, again in each gesture that asks.\
The help overlay, the menu and the input itself then answer the same question three ways, and drift.\
`input-binding` holds the decision once: rows declared as data, one match or none, one rule for click or drag, and one place that decides when each phase of a gesture is due, so every surface that asks gets the same answer.

**What it is.**\
An embeddable library with two capabilities: a table of declared rows that says which one row an input means in its context -- refusing ties, tracing how every row matched, and finding overlaps before they ship -- and a session that decides click or drop by one threshold, keeps which keys are held, and decides, for the one live gesture, when its start, its updates, its commit or its cancel are due.\
Rows, contexts and the code each phase runs are supplied by whoever asks; `input-binding` reads only what it needs and keeps no input but the state of one surface's presses, gesture and held keys.

**What it is not.**
- Not a listener: it never touches a platform's events.
- Not a hit tester or a renderer: what lies under a pointer, and what a gesture draws, are the application's.
- Not an executor: a row's action and a phase's code are the application's, never run by binding; the one call binding makes back is to ask, while it resolves a press, for that press's match and to report the gesture it cancelled.
- Not a precedence engine: two rows that both match mean nothing.
- Not a clock: time, when it is needed, arrives in the facts.
- Not a network service: it never listens and never sends.

**What success means.**
- **Agreement:** what an input does, what help says it does and what a tester highlights never disagree.
- **Determinism:** one recorded stream means one thing, in every engine, on every replay.
- **Leanness:** small enough that no application would rather write its own ladder.
- **Reuse:** a second, unrelated application adopts it without a variant, a fork or a change.

**Authority.**\
Held by the director; drafted by anyone, ratified only by the director; amended, never quietly rewritten.
