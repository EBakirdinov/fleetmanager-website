<?php

namespace App\Controller;

use Symfony\Bundle\FrameworkBundle\Controller\AbstractController;
use Symfony\Component\HttpFoundation\Response;
use Symfony\Component\Routing\Annotation\Route;

class DashboardController extends AbstractController
{
    /**
     * @Route("/{path}", name="home", requirements={"path"="^(?!_|build|api).*$"}, defaults={"path"=""}, methods={"GET"}, priority=-100)
     */
    public function index(): Response
    {
        $response = $this->render('index.html.twig');
        // The SPA shell references hashed Vite bundles; the shell itself must not be cached
        // or browsers keep pointing at stale asset filenames.
        $response->headers->set('Cache-Control', 'no-store, no-cache, must-revalidate, max-age=0');
        $response->headers->set('Pragma', 'no-cache');
        return $response;
    }
}
