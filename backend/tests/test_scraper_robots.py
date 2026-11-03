import pytest

from scraper.robots import RobotsRules

UA = "CatalogImporter/1.0 (+contact)"


def rules(text: str) -> RobotsRules:
    return RobotsRules.parse(text)


@pytest.mark.parametrize(
    ("path", "expected"),
    [
        ("/", True),
        ("/sofa/x", True),
        ("/checkout", False),
        ("/checkout/step-2", False),
        ("/bed/", False),
        ("/bed/king", False),
        ("/bedside", True),
    ],
)
def test_longest_match_wins_over_earlier_allow_all(path: str, expected: bool) -> None:
    robots = rules("User-Agent: *\nAllow: /\nDisallow: /checkout\nDisallow: /bed/\n")
    assert robots.can_fetch(UA, f"https://shop.example.com{path}") is expected


def test_allow_wins_a_tie_and_more_specific_allow_overrides() -> None:
    robots = rules("User-agent: *\nDisallow: /a\nAllow: /a\nDisallow: /p/\nAllow: /p/public\n")
    assert robots.can_fetch(UA, "https://s/a") is True
    assert robots.can_fetch(UA, "https://s/p/secret") is False
    assert robots.can_fetch(UA, "https://s/p/public/1") is True


def test_wildcards_and_end_anchor() -> None:
    robots = rules("User-agent: *\nDisallow: /*.pdf$\nDisallow: /*?sort=\n")
    assert robots.can_fetch(UA, "https://s/catalogue.pdf") is False
    assert robots.can_fetch(UA, "https://s/catalogue.pdf?x=1") is True
    assert robots.can_fetch(UA, "https://s/list?sort=price") is False
    assert robots.can_fetch(UA, "https://s/list?page=2") is True


def test_specific_agent_group_replaces_star_group() -> None:
    robots = rules("User-agent: *\nDisallow: /\n\nUser-agent: catalogimporter\nDisallow: /private\n")
    assert robots.can_fetch(UA, "https://s/sofa") is True
    assert robots.can_fetch(UA, "https://s/private/x") is False
    assert robots.can_fetch("OtherBot/2", "https://s/sofa") is False


def test_grouped_agents_comments_and_empty_disallow() -> None:
    robots = rules("# hi\nUser-agent: a\nUser-agent: *\nDisallow: # nothing blocked\n")
    assert robots.can_fetch(UA, "https://s/anything") is True


def test_no_rules_allows_everything() -> None:
    assert rules("").can_fetch(UA, "https://s/x") is True
