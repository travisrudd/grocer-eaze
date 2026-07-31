# Accessibility and usability release checklist

Automated checks run for every pull request and every update to `main`. Complete this short manual check for major interaction or layout changes.

## High-impact checks

- Complete the meal-planning journey using only the keyboard: build a plan, filter recipes, add a meal, review the schedule, and reach the grocery list.
- With VoiceOver and Safari on macOS, confirm that landmarks, page headings, form labels, recipe actions, progress updates, dialogs, and validation messages are announced in a useful order.
- With NVDA and Chrome on Windows, repeat the same core journey and confirm browse-mode and forms-mode behavior.
- Confirm that every dialog receives focus, traps focus while open, closes with Escape, and restores focus to its trigger.
- Confirm that errors identify the field or action that needs attention and never rely on color alone.

## Reflow and magnification

- At 200% and 400% browser zoom, check Plan, Recipe catalog, Grocery list, Family, Account, Plans, and Accessibility.
- Confirm content reflows without horizontal page scrolling at 400% zoom.
- Confirm sticky navigation and progress surfaces do not cover focused controls or status messages.
- Confirm text remains readable without clipping, overlap, or loss of functionality.

## General usability

- Follow every primary navigation item and footer action; each destination must have a clear purpose and next step.
- Check empty, loading, success, validation, and service-error states.
- Confirm disabled actions explain what unlocks them nearby.
- Confirm Back and Forward preserve the expected page and title.
- Confirm the recipe catalog initially limits results, “Show more” adds results, filters update the catalog, and clearing filters restores it.
- Confirm mobile controls are comfortably tappable and important actions remain visible without precision gestures.

## Recording results

Record the device, browser, assistive technology and version, tester, date, journey tested, issues found, and follow-up owner. A release should not proceed with an unresolved blocker affecting account access, meal planning, grocery-list creation, or feedback reporting.
