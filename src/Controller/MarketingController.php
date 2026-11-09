<?php

namespace App\Controller;

use App\Help\HelpArticles;
use Symfony\Bundle\FrameworkBundle\Controller\AbstractController;
use Symfony\Component\HttpFoundation\Response;
use Symfony\Component\HttpKernel\EventListener\AbstractSessionListener;
use Symfony\Component\Routing\Annotation\Route;

/**
 * The public, unauthenticated side of the site.
 *
 * These pages are deliberately server-rendered rather than routes in the SPA.
 * A prospect arrives from a search engine or a shared link, and both of those
 * read HTML: the SPA shell is one empty <div id="root"> for every URL, so a
 * crawler sees nothing and a per-page <title> is impossible. They also skip the
 * React bundle entirely, which is why they do not extend base.html.twig.
 */
class MarketingController extends AbstractController
{
    /**
     * Where a demo request should land until the POST handler exists. The
     * template builds a prefilled mailto: from it, so it is the only working
     * way to reach us from that form today.
     */
    private const CONTACT_EMAIL = 'sales@example.com';

    /**
     * @Route("/platform", name="marketing_platform", methods={"GET"})
     */
    public function platform(): Response
    {
        return $this->publicResponse(
            $this->render('marketing/platform.html.twig', [
                'contact_email' => self::CONTACT_EMAIL,
            ])
        );
    }

    /**
     * DashboardController's catch-all matches "platform/", so Symfony's own
     * trailing-slash redirect never gets the chance to fire — the SPA shell
     * would be served instead, under a second URL for the same page. Redirect
     * it explicitly to keep the canonical path the only one that answers.
     *
     * @Route("/platform/", name="marketing_platform_slash", methods={"GET"})
     */
    public function platformTrailingSlash(): Response
    {
        return $this->redirectToRoute('marketing_platform', [], Response::HTTP_MOVED_PERMANENTLY);
    }

    /**
     * Both files used to be static and both pointed at scheduleitup.com, a
     * different product, with a lastmod of 2021. Rendering them means the host
     * comes from the request, so there is no domain to keep in sync and they
     * are correct on localhost and in production alike.
     *
     * @Route("/robots.txt", name="marketing_robots", methods={"GET"})
     */
    public function robots(): Response
    {
        $response = $this->publicResponse($this->render('marketing/robots.txt.twig'));
        $response->headers->set('Content-Type', 'text/plain; charset=UTF-8');

        return $response;
    }

    /**
     * @Route("/sitemap.xml", name="marketing_sitemap", methods={"GET"})
     */
    public function sitemap(): Response
    {
        $response = $this->publicResponse($this->render('marketing/sitemap.xml.twig', [
            'help_articles' => HelpArticles::ordered(),
        ]));
        $response->headers->set('Content-Type', 'application/xml; charset=UTF-8');

        return $response;
    }

    /**
     * Makes a response cacheable despite the session being touched.
     *
     * App\Twig\GlobalExtension implements GlobalsInterface, so every single
     * Twig render — these pages included — calls AccountService::getUserData(),
     * which reads 'stoken' off the session. Reading a session starts it, and
     * AbstractSessionListener then rewrites any such response to
     * "private, max-age=0, must-revalidate" on the assumption that it contains
     * per-user content. These pages contain none, so opt out of that rewrite
     * and declare the caching we actually want.
     *
     * Note the PHPSESSID cookie is still set, which stops most CDNs from
     * storing the response. Fixing that properly means making GlobalExtension
     * lazy, and that service sits under the whole SPA shell — not a trade worth
     * making for the public pages alone.
     */
    private function publicResponse(Response $response): Response
    {
        $response->headers->set(AbstractSessionListener::NO_AUTO_CACHE_CONTROL_HEADER, 'true');
        $response->setPublic();
        $response->setMaxAge(300);
        $response->headers->addCacheControlDirective('stale-while-revalidate', '86400');

        return $response;
    }
}
