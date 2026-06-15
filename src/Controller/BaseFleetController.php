<?php

namespace App\Controller;

use Symfony\Bundle\FrameworkBundle\Controller\AbstractController;
use Symfony\Component\HttpFoundation\Session\SessionInterface;

abstract class BaseFleetController extends AbstractController
{
    protected function isAuthenticated(SessionInterface $session): bool
    {
        return (bool) $session->get('stoken');
    }
}
