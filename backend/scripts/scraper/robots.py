"""robots.txt evaluation per RFC 9309: the most specific (longest) matching rule wins, Allow wins ties.

The stdlib ``urllib.robotparser`` applies rules in file order, so a leading ``Allow: /`` would
unblock every later ``Disallow``; real crawlers do not behave that way.
"""

import re
from dataclasses import dataclass
from urllib.parse import urlsplit

STAR_AGENT = "*"


@dataclass(frozen=True)
class Rule:
    allow: bool
    pattern: str
    regex: re.Pattern[str]


@dataclass(frozen=True)
class Group:
    agents: tuple[str, ...]
    rules: tuple[Rule, ...]


def _compile(pattern: str) -> re.Pattern[str]:
    anchored = pattern.endswith("$")
    body = pattern[:-1] if anchored else pattern
    regex = ".*".join(re.escape(part) for part in body.split("*"))
    return re.compile(regex + ("$" if anchored else ""))


def _product_token(user_agent: str) -> str:
    return re.split(r"[/\s]", user_agent.strip(), maxsplit=1)[0].lower()


def _parse_groups(text: str) -> tuple[Group, ...]:
    groups: list[Group] = []
    agents: list[str] = []
    rules: list[Rule] = []
    in_rules = False
    for raw in text.splitlines():
        line = raw.split("#", 1)[0].strip()
        if ":" not in line:
            continue
        key, value = (part.strip() for part in line.split(":", 1))
        key = key.lower()
        if key == "user-agent":
            if in_rules:
                groups.append(Group(tuple(agents), tuple(rules)))
                agents, rules, in_rules = [], [], False
            agents.append(value.lower())
        elif key in ("allow", "disallow") and agents:
            in_rules = True
            if value:
                rules.append(Rule(key == "allow", value, _compile(value)))
    if agents:
        groups.append(Group(tuple(agents), tuple(rules)))
    return tuple(groups)


@dataclass(frozen=True)
class RobotsRules:
    groups: tuple[Group, ...]

    @classmethod
    def parse(cls, text: str) -> "RobotsRules":
        return cls(_parse_groups(text))

    def _rules_for(self, user_agent: str) -> tuple[Rule, ...]:
        token = _product_token(user_agent)
        specific = [g for g in self.groups if token in g.agents]
        chosen = specific or [g for g in self.groups if STAR_AGENT in g.agents]
        return tuple(rule for group in chosen for rule in group.rules)

    def can_fetch(self, user_agent: str, url: str) -> bool:
        parts = urlsplit(url)
        target = (parts.path or "/") + (f"?{parts.query}" if parts.query else "")
        matches = [r for r in self._rules_for(user_agent) if r.regex.match(target)]
        if not matches:
            return True
        best = max(matches, key=lambda r: (len(r.pattern), r.allow))
        return best.allow
