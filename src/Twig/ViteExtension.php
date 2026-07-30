<?php

namespace App\Twig;

use Twig\Extension\AbstractExtension;
use Twig\TwigFunction;

class ViteExtension extends AbstractExtension
{
    private const HOT_FILE_RELATIVE = '/build/.vite-dev';
    private const MANIFEST_RELATIVE = '/build/.vite/manifest.json';
    private const BUILD_PREFIX = '/build/';

    private $projectDir;

    public function __construct(string $projectDir)
    {
        $this->projectDir = $projectDir;
    }

    public function getFunctions(): array
    {
        return [
            new TwigFunction('vite_entry_link_tags', [$this, 'linkTags'], ['is_safe' => ['html']]),
            new TwigFunction('vite_entry_script_tags', [$this, 'scriptTags'], ['is_safe' => ['html']]),
        ];
    }

    public function linkTags(string $entry): string
    {
        if ($this->devServerUrl() !== null) {
            return '';
        }

        $manifestEntry = $this->manifestEntry($entry);
        $tags = [];

        foreach ($manifestEntry['css'] ?? [] as $cssFile) {
            $tags[] = sprintf('<link rel="stylesheet" href="%s">', self::BUILD_PREFIX . htmlspecialchars($cssFile, ENT_QUOTES));
        }

        return implode("\n    ", $tags);
    }

    public function scriptTags(string $entry): string
    {
        $devUrl = $this->devServerUrl();
        if ($devUrl !== null) {
            $base = $devUrl . self::BUILD_PREFIX;
            return sprintf(
                '<script type="module">' . "\n" .
                '        import RefreshRuntime from "%s@react-refresh"' . "\n" .
                '        RefreshRuntime.injectIntoGlobalHook(window)' . "\n" .
                '        window.$RefreshReg$ = () => {}' . "\n" .
                '        window.$RefreshSig$ = () => (type) => type' . "\n" .
                '        window.__vite_plugin_react_preamble_installed__ = true' . "\n" .
                '    </script>' . "\n" .
                '    <script type="module" src="%s@vite/client"></script>' . "\n" .
                '    <script type="module" src="%sassets/%s.tsx"></script>',
                $base,
                $base,
                $base,
                htmlspecialchars($entry, ENT_QUOTES)
            );
        }

        $manifestEntry = $this->manifestEntry($entry);
        $file = $manifestEntry['file'] ?? null;
        if (!$file) {
            throw new \RuntimeException(sprintf('Vite manifest entry "%s" has no "file" field.', $entry));
        }

        return sprintf('<script type="module" src="%s"></script>', self::BUILD_PREFIX . htmlspecialchars($file, ENT_QUOTES));
    }

    private function devServerUrl(): ?string
    {
        $hotFile = $this->projectDir . '/public' . self::HOT_FILE_RELATIVE;
        if (!is_file($hotFile)) {
            return null;
        }
        $url = trim((string) file_get_contents($hotFile));
        return $url !== '' ? rtrim($url, '/') : 'http://127.0.0.1:5173';
    }

    private function manifestEntry(string $entry): array
    {
        $path = $this->projectDir . '/public' . self::MANIFEST_RELATIVE;
        if (!is_file($path)) {
            throw new \RuntimeException(sprintf('Vite manifest not found at %s — run `pnpm run build` first.', $path));
        }

        $manifest = json_decode((string) file_get_contents($path), true);
        if (!is_array($manifest)) {
            throw new \RuntimeException(sprintf('Vite manifest at %s is not valid JSON.', $path));
        }

        $needle = 'assets/' . $entry . '.tsx';
        if (!isset($manifest[$needle])) {
            throw new \RuntimeException(sprintf('Vite manifest has no entry for "%s".', $needle));
        }

        return $manifest[$needle];
    }
}
