<?php

namespace App\Controller;

use App\Help\HelpArticles;
use Symfony\Bundle\FrameworkBundle\Controller\AbstractController;
use Symfony\Component\HttpFoundation\Response;
use Symfony\Component\HttpKernel\EventListener\AbstractSessionListener;
use Symfony\Component\Routing\Annotation\Route;

/**
 * The help articles.
 *
 * Server-rendered for the same reasons as the marketing page: the SPA shell is
 * one empty <div id="root"> for every URL, so help content inside it would be
 * unlinkable and unsearchable. Here each article has its own URL, which is what
 * makes "see /help/integrations" a usable thing to say to a customer.
 *
 * The app links in from TopBar, picking the article that matches the page the
 * user is on.
 */
class HelpController extends AbstractController
{
    /**
     * @Route("/help", name="help_index", methods={"GET"})
     */
    public function index(): Response
    {
        return $this->publicResponse($this->render('help/index.html.twig', [
            'tree' => HelpArticles::tree(),
            'current' => null,
        ]));
    }

    /**
     * The slug requirement keeps this off the SPA catch-all's turf and makes an
     * unknown article a 404 rather than a template-not-found 500.
     *
     * @Route("/help/{slug}", name="help_article", methods={"GET"}, requirements={"slug"="[a-z0-9-]+"})
     */
    public function article(string $slug): Response
    {
        if (!HelpArticles::has($slug)) {
            throw $this->createNotFoundException(sprintf('No help article "%s".', $slug));
        }

        $article = HelpArticles::get($slug);

        return $this->publicResponse($this->render('help/articles/' . $slug . '.html.twig', [
            'tree' => HelpArticles::tree(),
            'article' => $article,
            'current' => $slug,
            'neighbours' => HelpArticles::neighbours($slug),
        ]));
    }

    /**
     * See MarketingController::publicResponse() — App\Twig\GlobalExtension
     * reads the session on every render, which otherwise makes Symfony stamp
     * these pages private and uncacheable.
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
