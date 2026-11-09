<?php

namespace App\Help;

/**
 * The help table of contents.
 *
 * One source of truth for the sidebar, the /help index, the previous/next
 * links and the route's own slug validation — so adding an article is a new
 * Twig template under templates/help/articles/ plus one line here, and
 * everything else follows. Nothing scans the filesystem: an article that is
 * listed but has no template should fail loudly in development rather than
 * quietly vanish from the navigation.
 *
 * `icon` is a name from templates/marketing/_icons.html.twig.
 */
final class HelpArticles
{
    /**
     * Ordered. The order here is the reading order, and the previous/next
     * links walk it, so it should go roughly from first-day tasks to
     * reference material.
     *
     * @var array<int, array{title: string, articles: array<int, string>}>
     */
    const SECTIONS = [
        [
            'title' => 'Getting started',
            'articles' => ['getting-started'],
        ],
        [
            'title' => 'Dispatch',
            'articles' => ['loads', 'sending-loads', 'assigning-drivers', 'routing-and-miles'],
        ],
        [
            'title' => 'Fleet',
            'articles' => ['drivers', 'trucks-and-trailers'],
        ],
        [
            'title' => 'Operations',
            'articles' => ['maintenance', 'expenses'],
        ],
        [
            'title' => 'Administration',
            'articles' => ['integrations', 'users-and-permissions'],
        ],
        [
            'title' => 'Reference',
            'articles' => ['glossary'],
        ],
    ];

    /**
     * @var array<string, array{title: string, summary: string, icon: string}>
     */
    const ARTICLES = [
        'getting-started' => [
            'title' => 'Getting started',
            'summary' => 'What to set up first, in the order that saves the most re-typing.',
            'icon' => 'route',
        ],
        'loads' => [
            'title' => 'Loads and dispatch',
            'summary' => 'Building a load: stops, appointment windows, freight details, and the rate and cost breakdown.',
            'icon' => 'package',
        ],
        'sending-loads' => [
            'title' => 'Sending loads to drivers',
            'summary' => 'Email and SMS, the rate confirmation PDF, attachments, and what to do when one channel fails.',
            'icon' => 'send',
        ],
        'assigning-drivers' => [
            'title' => 'Assigning drivers',
            'summary' => 'How the suggestion list is ranked, and how to read blockers, warnings and matches.',
            'icon' => 'user-check',
        ],
        'routing-and-miles' => [
            'title' => 'Routing, miles and weather',
            'summary' => 'Loaded and empty miles, ETAs, and the difference between routed and estimated mileage.',
            'icon' => 'map-pin',
        ],
        'drivers' => [
            'title' => 'Drivers',
            'summary' => 'Driver records, CDL and medical expirations, endorsements and document slots.',
            'icon' => 'users',
        ],
        'trucks-and-trailers' => [
            'title' => 'Trucks and trailers',
            'summary' => 'Equipment records, inspection certificates, and how a truck gets paired with a driver and trailer.',
            'icon' => 'truck',
        ],
        'maintenance' => [
            'title' => 'Maintenance',
            'summary' => 'Service intervals, per-truck overrides, due states, repair orders and vendor spend.',
            'icon' => 'wrench',
        ],
        'expenses' => [
            'title' => 'Expenses and fuel',
            'summary' => 'The cost ledger: categories, receipts, the review workflow and imported fuel purchases.',
            'icon' => 'receipt',
        ],
        'integrations' => [
            'title' => 'Integrations',
            'summary' => 'Connecting an ELD, a fuel card, maps, email and SMS — and switching provider safely.',
            'icon' => 'plug',
        ],
        'users-and-permissions' => [
            'title' => 'Users and permissions',
            'summary' => 'Inviting people, the four roles, access levels, and granting or revoking a single permission.',
            'icon' => 'key-round',
        ],
        'glossary' => [
            'title' => 'Glossary',
            'summary' => 'Freight and platform terms used throughout the app, defined in one place.',
            'icon' => 'file-text',
        ],
    ];

    /** Slugs in reading order. */
    public static function ordered(): array
    {
        $slugs = [];
        foreach (self::SECTIONS as $section) {
            foreach ($section['articles'] as $slug) {
                $slugs[] = $slug;
            }
        }

        return $slugs;
    }

    public static function has(string $slug): bool
    {
        return isset(self::ARTICLES[$slug]);
    }

    /** @return array{slug: string, title: string, summary: string, icon: string} */
    public static function get(string $slug): array
    {
        return ['slug' => $slug] + self::ARTICLES[$slug];
    }

    /**
     * The articles either side of this one, for the footer links.
     *
     * @return array{prev: ?array, next: ?array}
     */
    public static function neighbours(string $slug): array
    {
        $ordered = self::ordered();
        $i = array_search($slug, $ordered, true);

        return [
            'prev' => $i > 0 ? self::get($ordered[$i - 1]) : null,
            'next' => $i !== false && isset($ordered[$i + 1]) ? self::get($ordered[$i + 1]) : null,
        ];
    }

    /**
     * The sidebar tree, with each slug resolved to its full article.
     *
     * @return array<int, array{title: string, articles: array<int, array>}>
     */
    public static function tree(): array
    {
        return array_map(static function (array $section): array {
            return [
                'title' => $section['title'],
                'articles' => array_map([self::class, 'get'], $section['articles']),
            ];
        }, self::SECTIONS);
    }
}
