<?php

/*
 * This file is part of the Symfony package.
 *
 * (c) Fabien Potencier <fabien@symfony.com>
 *
 * For the full copyright and license information, please view the LICENSE
 * file that was distributed with this source code.
 */

namespace App\Twig;

use Psr\Container\ContainerInterface;
use Symfony\Component\Intl\Intl;
use Twig\Extension\AbstractExtension;
use Twig\TwigFilter;
use Twig\TwigFunction;
use App\Service\Humandate;

/**
 * This Twig extension adds a new 'md2html' filter to easily transform Markdown
 * contents into HTML contents inside Twig templates.
 *
 * See https://symfony.com/doc/current/cookbook/templating/twig_extension.html
 *
 * @author Ryan Weaver <weaverryan@gmail.com>
 * @author Javier Eguiluz <javier.eguiluz@gmail.com>
 * @author Julien ITARD <julienitard@gmail.com>
 */
class AppExtension extends AbstractExtension
{
    private $container;

    /**
     * {@inheritdoc}
     */
    public function getFilters(): array
    {
        return [
            new TwigFilter('human_date', [new Humandate($this->container), 'convert']),
            new TwigFilter('max', [new AppExtension($this->container), 'max']),
            new TwigFilter('snake_case', [$this, 'snakeCase']),
        ];
    }

    /**
     * {@inheritdoc}
     */
    public function getFunctions(): array
    {
        return [
            new TwigFunction('locales', [$this, 'getLocales']),
        ];
    }

    public function max($array)
    {
        return max($array);
    }

    public function snakeCase($value)
    {
        return strtolower(preg_replace('/[A-Z]/', '_$0', lcfirst($value)));
    }
}
